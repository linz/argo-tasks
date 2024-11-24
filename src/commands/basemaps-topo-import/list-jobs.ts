import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import path from 'path';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { config, forceOutput, registerCli, tryParseUrl, verbose } from '../common.js';
import { isTiff } from '../tileindex-validate/tileindex.validate.js';

interface Output {
  /**
   * Input Topo Raster tiff files for processing
   */
  input: string[];

  /**
   * Output name for the processed tiff files
   */
  output: string;
}

/**
 * List all the tiffs in a directory and output the list of names to process.
 * Outputs a json file with the list of files to process.
 *
 * @example
 * [
 *  {
 *   "output": "CJ10_v1-00",
 *   "input": [
 *    "s3://topographic-upload/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/CJ10_GRIDLESS_GeoTifv1-00.tif"
 *   ]
 *  }
 * ]
 *
 * @param location: Location of the source files
 * @example s3://topographic-upload/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/
 */
export const basemapsListTopoJobs = command({
  name: 'list-topo-jobs',
  description: 'List input files and validate there are no duplicates.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    forceOutput,
    location: option({
      type: string,
      long: 'location',
      description: 'Location of the source files',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('ListJobs:Start');

    const files = await fsa.toArray(fsa.list(args.location));
    const outputs: Output[] = [];
    for (const file of files) {
      logger.info({ file }, 'ListJobs:File');
      if (!isTiff(file)) continue;

      const output = extractMapSheetName(file);
      outputs.push({ output, input: [file] });
    }

    if (outputs.length === 0) throw new Error('No tiff files found in the location');

    if (args.forceOutput || isArgo()) {
      await fsa.write('/tmp/list-topo-jobs/file-list.json', JSON.stringify(outputs, null, 2));
    }

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

export function extractMapSheetName(file: string): string {
  const url = tryParseUrl(file);
  const filePath = path.parse(url.href);
  const tileName = filePath.name;

  // pull map sheet name off front of tileName (e.g. CJ10)
  const mapSheetName = tileName.split('_')[0];
  // pull version off end of tileName (e.g. v1-0)
  const version = tileName.match(/v(\d)-(\d\d)/)?.[0];
  if (version == null) throw new Error('Version not found in the file name');

  const output = `${mapSheetName}_${version}`;
  logger.info({ mapSheetName, version, output }, 'ListJobs:Output');
  return output;
}
