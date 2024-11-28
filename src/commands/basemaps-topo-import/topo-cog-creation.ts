import { tmpdir } from 'node:os';

import { GdalRunner } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { fsa } from '@basemaps/shared';
import { CliId } from '@basemaps/shared/build/cli/info.js';
import { command, option, optional, restPositionals, string } from 'cmd-ts';
import { mkdir, rm } from 'fs/promises';
import pLimit from 'p-limit';
import path from 'path';
import { StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { HashTransform } from '../../utils/hash.stream.js';
import { config, forceOutput, registerCli, tryParseUrl, verbose } from '../common.js';
import { loadInput } from '../group/group.js';
import { gdalBuildCogCommands } from './gdal-commands.js';
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
          await createCogs(tryParseUrl(input), tmpFolder);
        }),
      ),
    );

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

async function createCogs(input: URL, tmp: URL): Promise<void> {
  const item = await fsa.readJson<StacItem>(input);
  const tmpFolder = new URL(item.id, tmp);
  try {
    // Extract the source URL from the item
    logger.info({ item: item.id }, 'CogCreation:Start');
    const source = item.links.find((l) => l.rel === 'linz_basemaps:source')?.href;
    if (source == null) throw new Error('No source file found in the item');
    await mkdir(tmpFolder, { recursive: true });

    // Download the source file
    const sourceUrl = tryParseUrl(source);
    const filePath = path.parse(sourceUrl.href);
    const fileName = filePath.base;
    const hashStreamSource = fsa.readStream(sourceUrl).pipe(new HashTransform('sha256'));
    const inputPath = new URL(fileName, tmpFolder);
    logger.info({ item: item.id, download: inputPath.href }, 'CogCreation:Download');
    await fsa.write(inputPath, hashStreamSource);

    // run gdal_translate for each job
    logger.info({ item: item.id }, 'CogCreation:gdal_translate');
    const tempPath = new URL(`${item.id}.tiff`, tmpFolder);
    const command = gdalBuildCogCommands(inputPath, tempPath);
    await new GdalRunner(command).run(logger);

    // fsa.write output to target location
    logger.info({ item: item.id }, 'CogCreation:Output');
    const readStream = fsa.readStream(tempPath).pipe(new HashTransform('sha256'));
    const outputPath = tryParseUrl(input.href.replace('.json', '.tiff'));
    await fsa.write(outputPath, readStream);
  } finally {
    // Cleanup the temporary folder once everything is done
    logger.info({ path: tmpFolder.href }, 'CogCreation:Cleanup');
    await rm(tmpFolder.href, { recursive: true, force: true });
  }
}
