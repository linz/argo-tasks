import { fsa } from '@basemaps/shared';
import { StacCollection, StacItem } from 'stac-ts';

import { logger } from '../../../log.js';

export async function writeStacFiles(
  target: URL,
  items: StacItem[],
  collection: StacCollection,
): Promise<{ itemPaths: URL[]; collectionPath: URL }> {
  // Create collection json for all topo50-latest items.
  logger.info({ target }, 'CreateStac:Output');
  logger.info({ items: items.length, collectionID: collection.id }, 'Stac:Output');

  const itemPaths: URL[] = [];

  for (const item of items) {
    const itemPath = new URL(`${item.id}.json`, target);
    itemPaths.push(itemPath);

    await fsa.write(itemPath, JSON.stringify(item, null, 2));
  }

  const collectionPath = new URL('collection.json', target);
  await fsa.write(collectionPath, JSON.stringify(collection, null, 2));

  return { itemPaths, collectionPath };
}
