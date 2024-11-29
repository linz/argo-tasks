import { createFileStats } from '@basemaps/cogify/build/cogify/stac.js';
import { fsa } from '@basemaps/shared';
import { command, option } from 'cmd-ts';
import path from 'path';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, forceOutput, registerCli, UrlFolder, verbose } from '../common.js';

interface Stats {
  'file:size': number;
  'file:checksum': string;
}

/**
 * This command adds checksum properties to the StacItems an StacCollection
 * JSON files that live in the input directory.
 *
 * @param input: Location of the StacItems and StacCollection to validate.
 * @example s3://linz-topographic/maps/topo50/gridless_300dpi/2193/
 */
export const topoStacValidation = command({
  name: 'topo-stac-validation',
  description: 'Get the list of topo cog stac items and creating cog for them.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    forceOutput,
    input: option({
      type: UrlFolder,
      long: 'input',
      description: 'Path of stac files to validate',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('StacValidate:Start');
    const files = await fsa.toArray(fsa.list(args.input));
    const items = files.filter((f) => f.href.endsWith('json') && !f.href.endsWith('collection.json'));
    if (items.length === 0) throw new Error('No item.json files found in the input path');

    logger.info('StacValidate:LoadStacItems');
    const itemsMap = await getStatsFromFiles(items);

    const collection = files.find((f) => f.href.endsWith('collection.json'));
    if (collection == null) throw new Error('No collection.json found in the input path');

    logger.info('StacValidate:ValidateStac');
    const collectionStac = await fsa.readJson<StacCollection>(collection);
    const links = collectionStac.links;
    for (const link of links) {
      if (link.rel === 'item') {
        const filename = link.href.replace('./', '');
        const itemStats = itemsMap.get(filename);
        if (itemStats == null) throw new Error(`Stac item ${link.href} from collection is not found or duplicated`);
        link['file:checksum'] = itemStats['file:checksum'];
        itemsMap.delete(filename);
      }
    }
    if (itemsMap.size > 0) throw new Error(`number: ${itemsMap.size} stac items not found from collection.`);

    // Write the stac collection after validation
    logger.info('StacValidate:UpdateStac');
    await fsa.write(collection, JSON.stringify(collectionStac, null, 2));
    logger.info({ duration: performance.now() - startTime }, 'StacValidate:Done');
  },
});

async function getStatsFromFiles(items: URL[]): Promise<Map<string, Stats>> {
  const itemsMap = new Map<string, Stats>();
  for (const item of items) {
    const filePath = path.parse(item.href);
    const buffer = await fsa.read(item);
    const stats = createFileStats(buffer);

    itemsMap.set(filePath.base, stats);
  }

  return itemsMap;
}
