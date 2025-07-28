import { basename } from 'node:path/posix';

import { fsa } from '@chunkd/fs';
import { command, option, optional, restPositionals, string } from 'cmd-ts';
import type { StacCollection, StacItem, StacLink } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { combinePaths, splitPaths } from '../../utils/chunk.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import type { FileListEntry } from '../../utils/filelist.ts';
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
    'Compares the "derived_from" link checksums stored in the Items from the "target-collection" dataset against the current checksum of the Items of the "source-collection" dataset. Returns a list of the source Items that have changed or been added. Note: If a target collection has been provided, its Items links must be resolvable. If no target is specified, all source Items will be added to the list.',
  version: CliInfo.version,
  args: {
    verbose,
    targetCollection: option({
      type: optional(string),
      long: 'target-collection',
      description:
        'Target collection.json file of the dataset that derives from the source dataset. If not provided, all Items of the source dataset will be returned in the list.',
    }),
    sourceCollections: restPositionals({
      type: string,
      displayName: 'source-collections',
      description:
        'Location of the source collection.json files that are used to create the target dataset. Split by ";"',
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
    const tilesToProcess: FileListEntry[] = Object.entries(itemsToProcess).map(([key, value]) => {
      const tiffInputs = value.map((item) => item.href.replace(/\.json$/, '.tiff'));
      return {
        output: key,
        input: sortInputsBySourceOrder(tiffInputs, sourceCollectionUrls),
        includeDerived: true,
      };
    });

    const fileListPath = '/tmp/identify-updated-items/file-list.json';
    await fsa.write(fileListPath, JSON.stringify(tilesToProcess));
    logger.info(
      {
        existingItems: Object.keys(existingItemsAtTarget).length,
        desiredItems: Object.keys(desiredItemsAtTarget).length,
        itemsToProcess: Object.keys(itemsToProcess).length,
        duration: performance.now() - startTime,
      },
      'identifyUpdatedItems:Done',
    );
  },
});

/**
 * Sorts the input file paths by their order in the source collections.
 *
 * @param inputs The input file paths to sort.
 * @param sourceCollections The source collections to use for sorting.
 * @returns The sorted input file paths.
 */
function sortInputsBySourceOrder(inputs: string[], sourceCollections: string[]): string[] {
  return inputs.sort((a, b) => {
    const indexA = sourceCollections.findIndex((src) => a.includes(src.replace('/collection.json', '')));
    const indexB = sourceCollections.findIndex((src) => b.includes(src.replace('/collection.json', '')));
    return indexA - indexB;
  });
}
