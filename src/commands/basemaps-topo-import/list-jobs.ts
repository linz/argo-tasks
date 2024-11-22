import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { config, forceOutput, registerCli, verbose } from '../common.js';

type Output = {
  output: string;
  input: string[];
};

/**
 * List all the tiffs in a directory and output the list of names to process.
 * Outputs a json file with the list of files to process.
 *
 * @example
 * [{
 *   "output": "CJ10_v1-00",
 *   "input": [
 *    "s3://topographic-upload/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/CJ10_GRIDLESS_GeoTifv1-00.tif"
 *  ]
 * }]
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

      if (file.endsWith('.tif') || file.endsWith('.tiff')) {
        const fileUrl = new URL(file);
        const tileName = fileUrl.pathname.split('/').pop();
        if (tileName == null) throw new Error(`Cannot get the tile name from file ${file}`);

        //Convert to the output filename
        const output = tileName.replace('.tif', '').replace('GRIDLESS_GeoTif', '');
        logger.info({ output }, 'ListJobs:Output');
        outputs.push({ output, input: [file] });
      }
    }

    if (args.forceOutput || isArgo())
      await fsa.write('/tmp/list-topo-jobs/file-list.json', JSON.stringify(outputs, null, 2));
    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});
