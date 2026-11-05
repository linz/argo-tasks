import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';
import type * as st from 'stac-ts';

import { hashBuffer } from '../../../utils/hash.ts';
import { createItemFiles, setRootLink } from '../stac.github.import.ts';

describe('setRootLink', () => {
  it('should replace an existing root link', () => {
    const links: st.StacLink[] = [{ rel: 'self', href: './collection.json' }, { rel: 'root', href: './catalog.json' }];
    setRootLink(links, 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json');
    assert.deepEqual(links, [
      { rel: 'self', href: './collection.json' },
      {
        rel: 'root',
        href: 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
    ]);
  });

  it('should add a missing root link first', () => {
    const links: st.StacLink[] = [{ rel: 'collection', href: './collection.json' }];
    setRootLink(links, 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json');
    assert.deepEqual(links, [
      {
        rel: 'root',
        href: 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'collection', href: './collection.json' },
    ]);
  });
});

describe('createItemFiles', () => {
  const memory = new FsMemory();
  const rootHref = 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json';
  const sourceCollection = fsa.toUrl('memory://source/collection.json');
  const targetCollection = fsa.toUrl('s3://nz-flood-map/new-zealand/flood-depth/present-day_1pct/2193/collection.json');

  before(() => {
    fsa.register('memory://', memory);
  });
  beforeEach(() => memory.files.clear());

  it('should import the items next to the collection', async () => {
    const item = { type: 'Feature', id: 'AB01', links: [{ rel: 'collection', href: './collection.json' }] };
    await fsa.write(fsa.toUrl('memory://source/AB01.json'), Buffer.from(JSON.stringify(item)));
    const collection = {
      links: [
        { rel: 'self', href: './collection.json' },
        { rel: 'item', href: './AB01.json', 'file:checksum': '1220', 'file:size': 1 },
      ],
    } as unknown as st.StacCollection;

    const files = await createItemFiles(collection, sourceCollection, targetCollection, rootHref);

    assert.equal(files.length, 1);
    const file = files[0];
    assert.ok(file);
    assert.equal(file.path, 'stac/new-zealand/flood-depth/present-day_1pct/2193/AB01.json');
    const imported = JSON.parse(file.content) as st.StacItem;
    assert.deepEqual(imported.links, [
      { rel: 'root', href: rootHref, type: 'application/json' },
      { rel: 'collection', href: './collection.json' },
    ]);
    const content = Buffer.from(file.content);
    assert.equal(collection.links[1]?.['file:checksum'], hashBuffer(content));
    assert.equal(collection.links[1]?.['file:size'], content.length);
  });

  it('should not add file:checksum when the item link has none', async () => {
    const item = { type: 'Feature', id: 'AB02', links: [] };
    await fsa.write(fsa.toUrl('memory://source/AB02.json'), Buffer.from(JSON.stringify(item)));
    const collection = { links: [{ rel: 'item', href: './AB02.json' }] } as unknown as st.StacCollection;

    await createItemFiles(collection, sourceCollection, targetCollection, rootHref);

    assert.deepEqual(collection.links, [{ rel: 'item', href: './AB02.json' }]);
  });

  it('should reject items outside of the collection folder', async () => {
    const collection = { links: [{ rel: 'item', href: '../other/AB01.json' }] } as unknown as st.StacCollection;

    await assert.rejects(createItemFiles(collection, sourceCollection, targetCollection, rootHref), /is not inside/);
  });
});
