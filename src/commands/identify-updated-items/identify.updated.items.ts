import { basename } from 'node:path/posix';

import { fsa } from '@chunkd/fs';
import { command, option, optional, restPositionals, string } from 'cmd-ts';
import type { StacCollection, StacItem, StacLink } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { combinePaths, splitPaths } from '../../utils/chunk.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { createFileList } from '../../utils/filelist.ts';
import { registerCli, verbose } from '../common.ts';

interface LinzItemLink extends StacLink {
  'file:checksum': string;
}
interface LinzStacItem extends StacItem {
  links: LinzItemLink[];
}
interface LinzStacCollection extends StacCollection {
  links: LinzItemLink[];
}

export const commandIdentifyUpdatedItems = command({
  name: 'identify-updated-items',
  description:
    'Get a list of STAC items from source datasets that have changed or been added to the source compared to the optional target collection, based on existing hashes in linked STAC documents. Note: If a target collection has been provided, its items links must be resolvable. If no target is specified, all items will be considered updated/new',
  version: CliInfo.version,
  args: {
    verbose,
    targetCollection: option({
      type: optional(string),
      long: 'target-collection',
      description:
        'Target collection.json file that needs to be updated. If not provided, all items will be considered updated/new.',
    }),
    sourceCollections: restPositionals({
      type: string,
      displayName: 'source-collections',
      description: 'Location of the source collection.json files. Split by ";"',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('identifyUpdatedItems:Start');

    if (args.targetCollection && !args.targetCollection.endsWith('collection.json')) {
      logger.error('--target-collection must point to an existing STAC collection.json or not be set');
      throw new Error('--target-collection must point to an existing STAC collection.json or not be set');
    }
    const sourceCollectionUrls = splitPaths(args.sourceCollections);
    if (sourceCollectionUrls.length === 0 || sourceCollectionUrls.some((str) => !str.endsWith('collection.json'))) {
      logger.error('Source collections must each point to existing STAC collection.json file(s)');
      throw new Error('--source-collections must point to existing STAC collection.json file(s)');
    }
    type ItemSourceChecksums = Record<string, { href: string; checksum: string }[]>;

    const existingItemsAtTarget: ItemSourceChecksums = {};
    const desiredItemsAtTarget: ItemSourceChecksums = {};
    const itemsToProcess: ItemSourceChecksums = {};

    const Q = new ConcurrentQueue(10);

    if (args.targetCollection) {
      const targetCollection = await fsa.readJson<LinzStacCollection>(args.targetCollection);
      for (const collectionLink of targetCollection.links) {
        if (collectionLink.rel !== 'item') continue;
        const itemUrl = combinePaths(args.targetCollection, collectionLink.href);
        Q.push(async () => {
          const itemStac = await fsa.readJson<LinzStacItem>(itemUrl);
          itemStac.links.forEach((itemLink) => {
            if (itemLink.rel !== 'derived_from') return;
            const myItemId = itemStac.id ?? basename(itemLink.href, '.json');
            if (!existingItemsAtTarget[myItemId]) {
              existingItemsAtTarget[myItemId] = []; // Initialize an empty array if not present
            }
            existingItemsAtTarget[myItemId].push({
              href: itemLink.href,
              checksum: itemLink['file:checksum'],
            });
          });
        });
      }
    }

    await Promise.all(
      sourceCollectionUrls.map(async (sourceCollectionUrl) => {
        const sourceCollection = await fsa.readJson<LinzStacCollection>(sourceCollectionUrl);
        sourceCollection.links.forEach((sourceItem) => {
          if (sourceItem.rel !== 'item') return;
          const myItemId = basename(sourceItem.href, '.json');
          if (!desiredItemsAtTarget[myItemId]) {
            desiredItemsAtTarget[myItemId] = [];
          }
          desiredItemsAtTarget[myItemId].push({
            href: combinePaths(sourceCollectionUrl, sourceItem.href),
            checksum: sourceItem['file:checksum'],
          });
        });
      }),
    );
    await Q.join().catch((err: unknown) => {
      // Composite errors get swallowed when rethrown through worker threads
      logger.fatal({ err }, 'identifyUpdatedItems:Failed');
      throw err;
    });
    logger.debug(existingItemsAtTarget);
    logger.debug(desiredItemsAtTarget);
    for (const [itemId, desiredItemChecksums] of Object.entries(desiredItemsAtTarget)) {
      const existingItemChecksums = existingItemsAtTarget[itemId] ?? [];
      logger.trace({ existingItemChecksums, desiredItemChecksums }, `identifyUpdatedItems:Checking ${itemId}`);
      // If the item is new, add to processing list
      if (existingItemChecksums.length === 0) {
        logger.debug({ itemId }, `identifyUpdatedItems:Processing ${itemId} because it is new`);
        itemsToProcess[itemId] = desiredItemChecksums;
        continue;
      }
      // If number of sources differs, add to processing list
      if (existingItemChecksums.length !== desiredItemChecksums.length) {
        logger.debug(
          { existing: existingItemChecksums.length, desired: desiredItemChecksums.length },
          `identifyUpdatedItems:Processing ${itemId} because number of sources differ`,
        );
        itemsToProcess[itemId] = desiredItemChecksums;
        continue;
      }

      // Check if all sources match exactly
      const needsProcessing = desiredItemChecksums.some(
        (desired) =>
          !existingItemChecksums.some(
            (existing) => existing.href === desired.href && existing.checksum === desired.checksum,
          ),
      );

      if (needsProcessing) {
        logger.debug({ itemId }, `identifyUpdatedItems:Processing ${itemId} because sources differ`);
        itemsToProcess[itemId] = desiredItemChecksums;
        continue;
      }
      logger.trace({ itemId }, `identifyUpdatedItems:Skipping ${itemId} because sources match`);
    }
    const tilesToProcess = createFileList(
      new Map(
        Object.entries(itemsToProcess).map(([key, value]) => [
          key,
          value.map((item) => item.href.replace(/\.json$/, '.tiff')),
        ]),
      ),
      true,
    );

    const fileListPath = '/tmp/identify-updated-items/file-list.json';
    await fsa.write(fileListPath, JSON.stringify(tilesToProcess));
    logger.info(
      {
        existingItems: Object.keys(existingItemsAtTarget).length,
        desiredItems: Object.keys(desiredItemsAtTarget).length,
        itemsToProcess: Object.keys(itemsToProcess).length,
        itemsToProcessList: Object.keys(itemsToProcess).join(','),
        duration: performance.now() - startTime,
      },
      'identifyUpdatedItems:Done',
    );
  },
});
