import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import type { TestContext } from 'node:test';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import type * as st from 'stac-ts';

import type { GithubFiles } from '../../../utils/github.ts';
import { GithubApi } from '../../../utils/github.ts';
import { commandStacGithubImport, createItemFiles, findUnlinkedItemFiles } from '../stac.github.import.ts';

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

describe('commandStacGithubImport', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['GITHUB_APP_ID'] = '1';
    process.env['GITHUB_APP_PRIVATE_KEY'] = 'any-github-app-private-key';
    process.env['GITHUB_APP_INSTALLATION_ID'] = '2';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function importCollection(t: TestContext, repoName: string): Promise<string[]> {
    const collection = { id: 'any-id', title: 'any-title', links: [{ rel: 'item', href: './AB01.json' }] };
    await fsa.write(fsa.toUrl('memory://source/config-url'), Buffer.from('https://basemaps.linz.govt.nz'));
    await fsa.write(fsa.toUrl('memory://source/collection.json'), Buffer.from(JSON.stringify(collection)));
    await fsa.write(fsa.toUrl('memory://source/AB01.json'), Buffer.from('{}'));
    const catalog = {
      links: [{ rel: 'self', href: 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json' }],
    };
    t.mock.method(GithubApi.prototype, 'getContent', () => Promise.resolve(JSON.stringify(catalog)));
    t.mock.method(GithubApi.prototype, 'getBranch', () => Promise.resolve(undefined));
    t.mock.method(GithubApi.prototype, 'listFiles', () => Promise.resolve([`${folder}/AB02.json`]));
    const committed: string[] = [];
    t.mock.method(GithubApi.prototype, 'createPullRequest', (...args: unknown[]) => {
      const files = args[2] as GithubFiles[];
      for (const file of files) committed.push(`${file.content == null ? '-' : '+'} ${file.path}`);
      return Promise.resolve(null);
    });

    await commandStacGithubImport.handler({
      config: undefined,
      verbose: false,
      source: fsa.toUrl('memory://source/'),
      target: fsa.toUrl(target),
      repoName,
      copyOption: '--no-clobber',
      ticket: '',
    });
    return committed;
  }

  it('should import the items for linz/flood-map', async (t) => {
    const committed = await importCollection(t, 'linz/flood-map');

    assert.deepEqual(committed.slice(0, 3), [
      `+ ${folder}/collection.json`,
      `+ ${folder}/AB01.json`,
      `- ${folder}/AB02.json`,
    ]);
    assert.match(committed[3] ?? '', /^\+ publish-odr-parameters\/any-id-\d+\.yaml$/);
  });

  it('should only import the collection for linz/imagery', async (t) => {
    const committed = await importCollection(t, 'linz/imagery');

    assert.deepEqual(committed.slice(0, 1), [`+ ${folder}/collection.json`]);
    assert.match(committed[1] ?? '', /^\+ publish-odr-parameters\/any-id-\d+\.yaml$/);
    assert.equal(committed.length, 2);
  });
});
