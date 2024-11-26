import { GdalRunner } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import path from 'path';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, forceOutput, registerCli, tryParseUrl, verbose } from '../common.js';
import { isTiff } from '../tileindex-validate/tileindex.validate.js';
import { gdalBuildCogCommands } from './gdal-commands.js';

interface ImportJob {
  /**
   * Input location of the topographic raster tiff file.
   *
   * @example "s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/CJ10_GRIDLESS_GeoTifv1-00.tif"
   */
  input: string;

  /**
   * Map code of the topographic raster tiff file.
   *
   * @example "CJ10"
   */
  mapCode: string;

  /**
   * Version of the topographic raster tiff file.
   *
   * @example "v1-00"
   */
  version: string;

  /**
   * Output location for the processed tiff file.
   *
   * @example TODO
   */
  output: string;
}

/**
 * List all the tiffs in a directory for topographic maps and create cogs for each.
 *
 * @param source: Location of the source files
 * @example s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/
 *
 * @param target: Location of the target path
 */
export const importTopographicMaps = command({
  name: 'import-topographic-maps',
  description: 'List input topographic files and run dgal to standardize and import into target.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    forceOutput,
    source: option({
      type: string,
      long: 'source',
      description: 'Location of the source files',
    }),
    target: option({
      type: string,
      long: 'target',
      description: 'Target location for the output files',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('ListJobs:Start');

    // extract all file paths from the source directory
    const files = await fsa.toArray(fsa.list(args.source));

    // map each file path into an ImportJob
    const jobs: ImportJob[] = [];

    for (const file of files) {
      logger.info({ file }, 'ListJobs:File');
      if (!isTiff(file)) continue;

      const { mapCode, version } = extractMapSheetNameWithVersion(file);
      const job: ImportJob = {
        input: file,
        mapCode,
        version,
        output: fsa.join(args.target, `${mapCode}_${version}.tiff`),
      };

      jobs.push(job);
    }

    if (jobs.length === 0) throw new Error('No tiff files found in the location');

    // run gdal_translate for each job
    for (const job of jobs) {
      const command = gdalBuildCogCommands(tryParseUrl(job.input), tryParseUrl(job.output));
      logger.level = 'debug';
      await new GdalRunner(command).run(logger);
    }

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

/**
 * Extract the map sheet name and version from the provided path.
 * Throws an error if either detail cannot be parsed.
 *
 * @param file: Location of the source file
 *
 * @example
 * file: "s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/CJ10_GRIDLESS_GeoTifv1-00.tif"
 * returns: { mapCode: "CJ10", version: "v1-00" }
 *
 * @returns
 */
export function extractMapSheetNameWithVersion(file: string): { mapCode: string; version: string } {
  const url = tryParseUrl(file);
  const filePath = path.parse(url.href);
  const tileName = filePath.name;

  // extract map code from head of the filepath (e.g. CJ10)
  const mapCode = tileName.split('_')[0];
  if (mapCode == null) throw new Error('Map sheet not found in the file name');

  // extract version from tail of the filepath (e.g. v1-0)
  const version = tileName.match(/v(\d)-(\d\d)/)?.[0];
  if (version == null) throw new Error('Version not found in the file name');

  logger.info({ mapCode, version }, 'ListJobs:Output');
  return { mapCode, version };
}
