import { tmpdir } from 'node:os';

import { GdalRunner } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { createFileStats } from '@basemaps/cogify/build/cogify/stac.js';
import { Epsg } from '@basemaps/geo';
import { fsa, Tiff } from '@basemaps/shared';
import { CliId } from '@basemaps/shared/build/cli/info.js';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';
import { mkdir, rm } from 'fs/promises';
import pLimit from 'p-limit';
import path from 'path';
import { StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { HashTransform } from '../../utils/hash.stream.js';
import { config, forceOutput, registerCli, tryParseUrl, verbose } from '../common.js';
import { loadInput } from '../group/group.js';
import { gdalBuildCogCommands as gdalBuildCog } from './gdal/gdal-build-cog.js';
import { gdalBuildVrt } from './gdal/gdal-build-vrt.js';
import { gdalBuildVrtWarp } from './gdal/gdal-build-vrt-warp.js';

const Q = pLimit(10);

/**
 * List all the tiffs in a directory for topographic maps and create cogs for each.
 *
 * @param source: Location of the source files
 * @example s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/
 *
 * @param target: Location of the target path
 */
export const topoCogCreation = command({
  name: 'topo-cog-creation',
  description: 'Get the list of topo cog stac items and creating cog for them.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    forceOutput,
    inputs: restPositionals({
      type: string,
      displayName: 'items',
      description: 'list of items to group, can be a JSON array',
    }),
    fromFile: option({
      type: optional(string),
      long: 'from-file',
      description: 'JSON file to load inputs from, must be a JSON Array',
    }),
    pixelTrim: option({
      type: optional(number),
      long: 'pixel-trim',
      description: 'number of pixels to trim from the right side of the image',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('ListJobs:Start');

    // Load the items for processing
    const inputs: string[] = [];
    for (const input of args.inputs) inputs.push(...loadInput(input));
    if (args.fromFile && (await fsa.exists(tryParseUrl(args.fromFile)))) {
      const input = await fsa.readJson<string[]>(tryParseUrl(args.fromFile));
      if (Array.isArray(input)) inputs.push(...input);
    }

    if (inputs.length === 0) {
      logger.error('Group:Error:Empty');
      process.exit(1);
    }

    // Prepare temporary folder for dgdal to create cog
    const tmpPath = path.join(tmpdir(), CliId);
    const tmpURL = tryParseUrl(tmpPath);
    const tmpFolder = tmpURL.href.endsWith('/') ? new URL(tmpURL.href) : new URL(`${tmpURL.href}/`);
    await Promise.all(
      inputs.map((input) =>
        Q(async () => {
          await createCogs(tryParseUrl(input), tmpFolder, args.pixelTrim);
        }),
      ),
    );

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

async function createCogs(input: URL, tmp: URL, pixelTrim?: number): Promise<void> {
  const startTime = performance.now();
  const item = await fsa.readJson<StacItem>(input);
  const tmpFolder = new URL(item.id, tmp);
  try {
    // Extract the source URL from the item
    logger.info({ item: item.id }, 'CogCreation:Start');
    const source = item.assets['source']?.href;
    if (source == null) throw new Error('No source file found in the item');
    await mkdir(tmpFolder, { recursive: true });

    // Download the source file
    const sourceUrl = tryParseUrl(source);
    const filePath = path.parse(sourceUrl.href);
    const fileName = filePath.base;
    if (!(await fsa.exists(sourceUrl))) throw new Error('Source file not found');
    const hashStreamSource = fsa.readStream(sourceUrl).pipe(new HashTransform('sha256'));

    const inputPath = new URL(fileName, tmpFolder);
    logger.info({ item: item.id, download: inputPath.href }, 'CogCreation:Download');
    // Add checksum for source file
    if (item.assets['source'] == null) throw new Error('No source file found in the item');
    await fsa.write(inputPath, hashStreamSource);
    item.assets['source']['file:checksum'] = hashStreamSource.multihash;
    item.assets['source']['file:size'] = hashStreamSource.size;

    // read resolution from first image of tiff
    const tiff = await new Tiff(fsa.source(inputPath)).init();
    const sourceRes = tiff.images[0]?.resolution;
    if (sourceRes == null) throw new Error('Could not read resolution from first image');

    // run gdal commands for each source file

    /**
     * command: gdal build vrt
     */
    logger.info({ item: item.id }, 'CogCreation:gdalbuildvrt');

    const vrtPath = new URL(`${item.id}.vrt`, tmpFolder);
    const commandBuildVrt = gdalBuildVrt(vrtPath, [inputPath]);

    await new GdalRunner(commandBuildVrt).run(logger);

    /**
     * command: gdal build warp vrt
     */
    logger.info({ item: item.id }, 'CogCreation:gdalwarp');

    const sourceEpsg = item.properties['proj:epsg'];
    if (typeof sourceEpsg !== 'number') throw new Error(`Could not read 'proj:epsg' property from StacItem`);

    const sourceProj = Epsg.tryGet(sourceEpsg);
    if (sourceProj == null) throw new Error(`Unknown source projection ${sourceEpsg}`);

    const vrtWarpPath = new URL(`${item.id}-warp.vrt`, tmpFolder);
    const commandBuildVrtWarp = gdalBuildVrtWarp(vrtWarpPath, vrtPath, sourceProj);

    await new GdalRunner(commandBuildVrtWarp).run(logger);

    /**
     * command: gdal build cog
     */
    logger.info({ item: item.id }, 'CogCreation:gdal_translate');

    const width = Number(item.properties['source.width']);
    const height = Number(item.properties['source.height']);
    const tempPath = new URL(`${item.id}.tiff`, tmpFolder);
    const commandTranslate = gdalBuildCog(vrtWarpPath, tempPath, width, height, { pixelTrim });

    await new GdalRunner(commandTranslate).run(logger);

    // fsa.write output to target location
    logger.info({ item: item.id }, 'CogCreation:Output');
    const readStream = fsa.readStream(tempPath).pipe(new HashTransform('sha256'));
    const outputPath = tryParseUrl(input.href.replace('.json', '.tiff'));
    await fsa.write(outputPath, readStream);

    // Add the asset of created cog into stac item
    const stac = await fsa.read(outputPath);
    item.assets['cog'] = {
      href: `./${item.id}.tiff`,
      type: 'image/tiff; application=geotiff; profile=cloud-optimized',
      roles: ['data'],
      ...createFileStats(stac),
    };
    await fsa.write(input, JSON.stringify(item, null, 2));
  } finally {
    // Cleanup the temporary folder once everything is done
    logger.info({ path: tmpFolder.href }, 'CogCreation:Cleanup');
    await rm(tmpFolder.href, { recursive: true, force: true });
    logger.info({ duration: performance.now() - startTime }, 'CogCreation:Done');
  }
}
