import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';
import type * as st from 'stac-ts';

import type { GithubApi } from '../../../utils/github.ts';
import { createItemFiles, findUnlinkedItemFiles } from '../stac.github.import.ts';

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

    await assert.rejects(createItemFiles(collection, sourceCollection, targetCollection), /not a relative path/);
  });

  it('should reject absolute item links', async () => {
    const href = 's3://nz-flood-map/new-zealand/flood-depth/present-day_1pct/2193/AB01.json';
    const collection = { links: [{ rel: 'item', href }] } as unknown as st.StacCollection;

    await assert.rejects(createItemFiles(collection, sourceCollection, targetCollection), /not a relative path/);
  });

  it('should check every item link before reading any item', async () => {
    const collection = {
      links: [
        { rel: 'item', href: './missing.json' },
        { rel: 'item', href: '../other/AB01.json' },
      ],
    } as unknown as st.StacCollection;

    await assert.rejects(createItemFiles(collection, sourceCollection, targetCollection), /not a relative path/);
  });

  it('should reject a collection without items', async () => {
    const collection = { links: [{ rel: 'self', href: './collection.json' }] } as unknown as st.StacCollection;

    await assert.rejects(createItemFiles(collection, sourceCollection, targetCollection), /No items linked/);
  });
});

describe('findUnlinkedItemFiles', () => {
  const folder = 'stac/new-zealand/flood-depth/present-day_1pct/2193';
  const collectionPath = `${folder}/collection.json`;
  const existing = [`${folder}/collection.json`, `${folder}/AB01.json`, `${folder}/AB02.json`, `${folder}/README.md`];

  function fakeGithub(branchSha: string | undefined, listed: string[][]): Pick<GithubApi, 'getBranch' | 'listFiles'> {
    return {
      getBranch: (): Promise<string | undefined> => Promise.resolve(branchSha),
      listFiles: (ref: string, path: string): Promise<string[]> => {
        listed.push([ref, path]);
        return Promise.resolve(existing);
      },
    };
  }

  it('should delete the item files the collection no longer links', async () => {
    const listed: string[][] = [];
    const items = [{ path: `${folder}/AB01.json`, content: '{}' }];

    const files = await findUnlinkedItemFiles(fakeGithub(undefined, listed), 'feat/bot', collectionPath, items);

    assert.deepEqual(files, [{ path: `${folder}/AB02.json`, content: null }]);
    assert.deepEqual(listed, [['master', folder]]);
  });

  it('should list the files of an existing branch', async () => {
    const listed: string[][] = [];
    const items = [
      { path: `${folder}/AB01.json`, content: '{}' },
      { path: `${folder}/AB02.json`, content: '{}' },
    ];

    const files = await findUnlinkedItemFiles(fakeGithub('any-sha', listed), 'feat/bot', collectionPath, items);

    assert.deepEqual(files, []);
    assert.deepEqual(listed, [['any-sha', folder]]);
  });
});
