import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import type { FileListEntryClass } from '../../../utils/filelist.ts';
import { Url, UrlList } from '../../common.ts';
import type { IdentifyUpdatedItemsArgs } from '../identify.updated.items.ts';
import { commandIdentifyUpdatedItems } from '../identify.updated.items.ts';
/**
 * Test cases implemented:
 * Do not process:
 *   BD31: target item exists and its checksum is equal to derived_from item
 * Process:
 *   BD32: target item exists and its checksum is different to derived_from item
 *   BD35: target item exists and source has added the 1m derived_from item
 *   BD36: target item exists and source has removed the 1m derived_from item
 *   BD33: target item does not exist, but does exist in the source collection
 */

describe('identify-updated-items', () => {
  const baseArgs = {
    verbose: false,
    targetCollection: Url.from('./src/commands/identify-updated-items/__test__/data/hillshade/collection.json'),
    sourceCollections: UrlList.from(
      './src/commands/identify-updated-items/__test__/data/dem_8m/collection.json;./src/commands/identify-updated-items/__test__/data/dem_1m/collection.json',
    ),
  };
  it('should throw an error if no source collections are provided', async () => {
    const args = {
      ...baseArgs,
      sourceCollections: [],
    };
    const resolvedArgs = (await Promise.all(Object.entries(args).map(async ([key, value]) => [key, await value])).then(
      Object.fromEntries,
    )) as IdentifyUpdatedItemsArgs;
    await assert.rejects(commandIdentifyUpdatedItems.handler(resolvedArgs), {
      message: '--source-collections must point to existing STAC collection.json file(s)',
    });
  });
  it('should throw an error if source collection does not point to collection.json file', async () => {
    const args = {
      ...baseArgs,
      sourceCollections: UrlList.from([
        './src/commands/identify-updated-items/__test__/data/dem_8m/',
        './src/commands/identify-updated-items/__test__/data/dem_1m/collection.json',
      ]),
    };
    const resolvedArgs = (await Promise.all(Object.entries(args).map(async ([key, value]) => [key, await value])).then(
      Object.fromEntries,
    )) as IdentifyUpdatedItemsArgs;
    await assert.rejects(commandIdentifyUpdatedItems.handler(resolvedArgs), {
      message: '--source-collections must point to existing STAC collection.json file(s)',
    });
  });
  it('should throw an error if a target collection is set but does not point to a "collection.json" file', async () => {
    const args = {
      ...baseArgs,
      targetCollection: Url.from('./src/commands/identify-updated-items/__test__/data/hillshade/'),
    };
    const resolvedArgs = (await Promise.all(Object.entries(args).map(async ([key, value]) => [key, await value])).then(
      Object.fromEntries,
    )) as IdentifyUpdatedItemsArgs;
    await assert.rejects(commandIdentifyUpdatedItems.handler(resolvedArgs), {
      message: '--target-collection must point to an existing STAC collection.json or not be set',
    });
  });

  it('should add all source items if no target collection is provided', async () => {
    const args = {
      ...baseArgs,
      targetCollection: undefined,
    };
    const resolvedArgs = (await Promise.all(Object.entries(args).map(async ([key, value]) => [key, await value])).then(
      Object.fromEntries,
    )) as IdentifyUpdatedItemsArgs;
    await commandIdentifyUpdatedItems.handler(resolvedArgs);
    const outputFileList: [FileListEntryClass] = await fsa.readJson(
      fsa.toUrl('/tmp/identify-updated-items/file-list.json'),
    );
    assert.deepEqual(outputFileList, [
      {
        output: 'BD31',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD31.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD31.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD32',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD32.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD32.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD33',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD33.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD33.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD35',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD35.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD35.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD36',
        input: ['./src/commands/identify-updated-items/__test__/data/dem_8m/BD36.tiff'],
        includeDerived: true,
      },
    ]);
  });

  it('should only add modified items to file-list.json', async () => {
    const args = { ...baseArgs };
    const resolvedArgs = (await Promise.all(Object.entries(args).map(async ([key, value]) => [key, await value])).then(
      Object.fromEntries,
    )) as IdentifyUpdatedItemsArgs;

    await commandIdentifyUpdatedItems.handler(resolvedArgs);
    const outputFileList: [FileListEntryClass] = await fsa.readJson(
      fsa.toUrl('/tmp/identify-updated-items/file-list.json'),
    );
    assert.deepEqual(outputFileList, [
      {
        output: 'BD32',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD32.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD32.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD33',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD33.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD33.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD35',
        input: [
          './src/commands/identify-updated-items/__test__/data/dem_8m/BD35.tiff',
          './src/commands/identify-updated-items/__test__/data/dem_1m/BD35.tiff',
        ],
        includeDerived: true,
      },
      {
        output: 'BD36',
        input: ['./src/commands/identify-updated-items/__test__/data/dem_8m/BD36.tiff'],
        includeDerived: true,
      },
    ]);
  });
});
