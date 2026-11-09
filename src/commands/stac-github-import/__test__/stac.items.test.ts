import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';
import type * as st from 'stac-ts';

import type { GithubApi } from '../../../utils/github.ts';
import { createItemFiles, findUnlinkedItemFiles } from '../stac.github.import.ts';

const memory = new FsMemory();
const folder = 'stac/new-zealand/flood-depth/present-day_1pct/2193';
const target = 's3://nz-flood-map/new-zealand/flood-depth/present-day_1pct/2193/';

before(() => {
  fsa.register('memory://', memory);
});
beforeEach(() => memory.files.clear());

describe('createItemFiles', () => {
  it('should import the items unchanged next to the collection', async () => {
    const item = '{"type":"Feature","id":"AB01","links":[{"rel":"collection","href":"./collection.json"}]}\n';
    await fsa.write(fsa.toUrl('memory://source/AB01.json'), Buffer.from(item));
    const links = [
      { rel: 'self', href: './collection.json' },
      { rel: 'item', href: './AB01.json', 'file:checksum': '1220', 'file:size': item.length },
    ];
    const collection = { links: structuredClone(links) } as unknown as st.StacCollection;

    const files = await createItemFiles(
      collection,
      fsa.toUrl('memory://source/collection.json'),
      fsa.toUrl(`${target}collection.json`),
    );

    assert.deepEqual(files, [{ path: `${folder}/AB01.json`, content: item }]);
    assert.deepEqual(collection.links, links);
  });
});

describe('findUnlinkedItemFiles', () => {
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
