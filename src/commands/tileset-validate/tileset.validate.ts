import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { command, restPositionals, string } from 'cmd-ts';
import { basename } from 'path';
import { logger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { MapSheet } from '../../utils/mapsheet.js';
import { config, registerCli, verbose } from '../common.js';

function isTiff(x: string): boolean {
  const search = x.toLowerCase();
  return search.endsWith('.tiff') || search.endsWith('.tif');
}

export const commandTileSetValidate = command({
  name: 'tileset-validate',
  description: 'Validate that tiffs match the NZ Tile Grid',
  args: {
    config,
    verbose,
    locations: restPositionals({ type: string, displayName: 'location', description: 'Where to list' }),
  },
  handler: async (args) => {
    registerCli(args);

    const Q = new ConcurrentQueue(50);

    let checked = 0;
    let total = 0;
    let failed = 0;
    for (const location of args.locations) {
      logger.info({ location }, 'Validate:Path');
      for await (const file of fsa.details(location)) {
        if (file.size === 0) continue;
        if (!isTiff(file.path)) continue;

        total++;
        Q.push(async () => {
          const cogTiff = new CogTiff(fsa.source(file.path));
          await cogTiff.init(true);

          const fileName = basename(file.path);

          // Bounds are [west, south, east, north]
          const bounds = cogTiff.getImage(0).bbox;
          checked++;

          const height = bounds[3] - bounds[1];
          const width = bounds[2] - bounds[0];
          const expected = MapSheet.extract(fileName)?.bounds;
          if (bounds[0] !== expected?.x || bounds[3] !== expected?.y) {
            // Failed origin

            failed++;
            logger.error({ fileName, got: { x: bounds[0], y: bounds[3] }, expected }, 'File:Invalid:Origin');
          } else if (width !== expected?.width || height !== expected.height) {
            // Failed on size of tile

            failed++;
            logger.error({ fileName, got: { width: width, height: height }, expected }, 'File:Invalid:Size');
          }

          if (checked % 100 === 0) logger.info({ checked, total, failed, lastFile: fileName }, 'File:Checked');
        });
      }
    }

    await Q.join();

    logger.info({ checked, total, failed }, 'File:Checked');
    if (failed > 0) {
      logger.error({ failures: failed }, 'TilesetValidate:Done:Failed');
      process.exit(1);
    }
  },
});
