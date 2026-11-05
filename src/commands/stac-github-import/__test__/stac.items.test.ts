import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';
import type * as st from 'stac-ts';

import { createItemFiles } from '../stac.github.import.ts';

describe('createItemFiles', () => {
  const memory = new FsMemory();
  const sourceCollection = fsa.toUrl('memory://source/collection.json');
  const targetCollection = fsa.toUrl('s3://nz-flood-map/new-zealand/flood-depth/present-day_1pct/2193/collection.json');

  before(() => {
    fsa.register('memory://', memory);
  });
  beforeEach(() => memory.files.clear());

  it('should import the items unchanged next to the collection', async () => {
    const item = '{"type":"Feature","id":"AB01","links":[{"rel":"collection","href":"./collection.json"}]}\n';
    await fsa.write(fsa.toUrl('memory://source/AB01.json'), Buffer.from(item));
    const links = [
      { rel: 'self', href: './collection.json' },
      { rel: 'item', href: './AB01.json', 'file:checksum': '1220', 'file:size': item.length },
    ];
    const collection = { links: structuredClone(links) } as unknown as st.StacCollection;

    const files = await createItemFiles(collection, sourceCollection, targetCollection);

    assert.deepEqual(files, [{ path: 'stac/new-zealand/flood-depth/present-day_1pct/2193/AB01.json', content: item }]);
    assert.deepEqual(collection.links, links);
  });

  it('should reject items outside of the collection folder', async () => {
    const collection = { links: [{ rel: 'item', href: '../other/AB01.json' }] } as unknown as st.StacCollection;

    await assert.rejects(createItemFiles(collection, sourceCollection, targetCollection), /is not inside/);
  });
});
