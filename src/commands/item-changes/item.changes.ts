import { basename } from 'node:path/posix';

import { fsa } from '@chunkd/fs';
import { command, option, optional, restPositionals, string } from 'cmd-ts';
import type { StacCollection, StacItem, StacLink } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { combinePaths, splitPaths } from '../../utils/chunk.ts';
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

export const commandItemChanges = command({
  name: 'item-changes',
  description:
    'Get a list of STAC items from source datasets that have changed or been added to the source compared to the target collection, based on existing hashes in STAC.',
  version: CliInfo.version,
  args: {
    verbose,
    targetCollection: option({
      type: optional(string),
      long: 'target-collection',
      description: 'Target collection.json file that needs to be updated',
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
    logger.info('ItemChanges:Start');

    if (args.targetCollection && !args.targetCollection.endsWith('collection.json')) {
      logger.error('--target-collection must point to an existing STAC collection.json or not be set');

      return;
    }
    const targetCollectionUrl = args.targetCollection;
    const sourceCollectionUrls = splitPaths(args.sourceCollections);
    if (sourceCollectionUrls.length === 0 || sourceCollectionUrls.some((str) => !str.endsWith('collection.json'))) {
      logger.error('Source collections must each point to existing STAC collection.json file(s)');
      return;
    }
    type ItemSourceRecord = Record<string, { href: string; checksum: string }[]>;

    const existingTargetItems: ItemSourceRecord = {};
    const desiredTargetItems: ItemSourceRecord = {};
    const toProcessTargetItems: ItemSourceRecord = {};

    if (targetCollectionUrl) {
      const targetCollection = await fsa.readJson<LinzStacCollection>(targetCollectionUrl);
      await Promise.all(
        targetCollection.links.map(async (collectionLink) => {
          if (collectionLink.rel !== 'item') return;
          const itemUrl = combinePaths(targetCollectionUrl, collectionLink.href);
          const itemStac = await fsa.readJson<LinzStacItem>(itemUrl);
          itemStac.links.forEach((itemLink) => {
            if (itemLink.rel !== 'derived_from') return;
            const myItemId = itemStac.id ?? basename(itemLink.href, '.json');
            if (!existingTargetItems[myItemId]) {
              existingTargetItems[myItemId] = []; // Initialize an empty array if not present
            }
            existingTargetItems[myItemId].push({
              href: itemLink.href,
              checksum: itemLink['file:checksum'],
            });
          });
        }),
      );
    }

    await Promise.all(
      sourceCollectionUrls.map(async (sourceCollectionUrl) => {
        const sourceCollection = await fsa.readJson<LinzStacCollection>(sourceCollectionUrl);
        sourceCollection.links.forEach((sourceItem) => {
          if (sourceItem.rel !== 'item') return;
          const myItemId = basename(sourceItem.href, '.json');
          if (!desiredTargetItems[myItemId]) {
            desiredTargetItems[myItemId] = [];
          }
          desiredTargetItems[myItemId].push({
            href: combinePaths(sourceCollectionUrl, sourceItem.href),
            checksum: sourceItem['file:checksum'],
          });
        });
      }),
    );

    for (const [itemId, desiredSources] of Object.entries(desiredTargetItems)) {
      const existingSources = existingTargetItems[itemId] ?? [];
      logger.trace({ existingSources, desiredSources }, `ItemChanges:Checking ${itemId}`);
      // If the item is new, add to processing list
      if (existingSources.length === 0) {
        logger.debug({ itemId }, `ItemChanges:Processing ${itemId} because it is new`);
        toProcessTargetItems[itemId] = desiredSources;
        continue;
      }
      // If number of sources differs, add to processing list
      if (existingSources.length !== desiredSources.length) {
        logger.debug(
          { existing: existingSources.length, desired: desiredSources.length },
          `ItemChanges:Processing ${itemId} because number of sources differ`,
        );
        toProcessTargetItems[itemId] = desiredSources;
        continue;
      }

      // Check if all sources match exactly
      const needsProcessing = desiredSources.some(
        (desired) =>
          !existingSources.some((existing) => existing.href === desired.href && existing.checksum === desired.checksum),
      );

      if (needsProcessing) {
        logger.debug({ itemId }, `ItemChanges:Processing ${itemId} because sources differ`);
        toProcessTargetItems[itemId] = desiredSources;
        continue;
      }
      logger.trace({ itemId }, `ItemChanges:Skipping ${itemId} because sources match`);
    }
    const tilesToProcess = createFileList(
      new Map(
        Object.entries(toProcessTargetItems).map(([key, value]) => [
          key,
          value.map((item) => item.href.replace(/\.json$/, '.tiff')),
        ]),
      ),
      true,
    );

    const fileListPath = '/tmp/item-changes/file-list.json';
    await fsa.write(fileListPath, JSON.stringify(tilesToProcess));
    logger.info(
      {
        existingItems: Object.keys(existingTargetItems).length,
        desiredItems: Object.keys(desiredTargetItems).length,
        itemsToProcess: Object.keys(toProcessTargetItems).length,
        itemsToProcessList: Object.keys(toProcessTargetItems).join(','),
        duration: performance.now() - startTime,
      },
      'ItemChanges:Done',
    );
  },
});
