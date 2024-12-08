import { fsa } from '@basemaps/shared';
import { StacCollection, StacItem } from 'stac-ts';

import { logger } from '../../../log.js';
import { isArgo } from '../../../utils/argo.js';

export async function writeStacFiles(
  target: URL,
  force: boolean,
  items: StacItem[],
  collection: StacCollection,
): Promise<void> {
  // Create collection json for all topo50-latest items.
  if (force || isArgo()) {
    logger.info({ target }, 'CreateStac:Output');
    logger.info({ items: items.length, collectionID: collection.id }, 'Stac:Output');
    for (const item of items) {
      const itemPath = new URL(`${item.id}.json`, target);
      await fsa.write(itemPath, JSON.stringify(item, null, 2));
    }
    const collectionPath = new URL('collection.json', target);
    await fsa.write(collectionPath, JSON.stringify(collection, null, 2));
  }
}
