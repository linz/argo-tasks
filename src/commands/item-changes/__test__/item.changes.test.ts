import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import type { FileListEntry } from '../../../utils/filelist.js';
import { commandItemChanges } from '../item.changes.ts';

// TESTS TO IMPLEMENT
// target item, same derived_from item BD31
// target item, changed derived_from item checksum BD32
// target item, added derived_from item BD35
// target item, removed derived_from item BD36
// no target item, added derived_from item BD33

describe('item-changes', () => {
  const baseArgs = {
    verbose: false,
    targetCollection: './src/commands/item-changes/__test__/data/hillshade/collection.json',
    sourceCollections: [
      './src/commands/item-changes/__test__/data/dem_8m/collection.json',
      './src/commands/item-changes/__test__/data/dem_1m/collection.json',
    ],
  };
  it('should throw an error if no source collections are provided', async () => {
    const args = {
      ...baseArgs,
      sourceCollections: [],
    };
    await assert.rejects(commandItemChanges.handler(args), {
      message: '--source-collections must point to existing STAC collection.json file(s)',
    });
  });

  it('should add all source items if no target collection is provided', async () => {
    const args = {
      ...baseArgs,
      targetCollection: undefined,
    };
    await commandItemChanges.handler(args);
    const outputFileList: [FileListEntry] = await fsa.readJson('/tmp/file-list.json');
    assert.deepEqual(outputFileList, [
      {
        output: 'BD31',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD31.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD31.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD32',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD32.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD32.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD33',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD33.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD33.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD35',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD35.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD35.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD36',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD36.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD36.json',
        ],
        includeDerived: true,
      },
    ]);
  });

  it('should only add modified items to file-list.json', async () => {
    await commandItemChanges.handler(baseArgs);
    const outputFileList: [FileListEntry] = await fsa.readJson('/tmp/item-changes/file-list.json');
    assert.deepEqual(outputFileList, [
      {
        output: 'BD32',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD32.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD32.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD33',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD33.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD33.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD35',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD35.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD35.json',
        ],
        includeDerived: true,
      },
      {
        output: 'BD36',
        input: [
          './src/commands/item-changes/__test__/data/dem_8m/BD36.json',
          './src/commands/item-changes/__test__/data/dem_1m/BD36.json',
        ],
        includeDerived: true,
      },
    ]);
  });
});
