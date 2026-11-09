import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import type { TestContext } from 'node:test';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import type { GithubFiles } from '../../../utils/github.ts';
import { GithubApi } from '../../../utils/github.ts';
import { commandStacGithubImport } from '../stac.github.import.ts';

const memory = new FsMemory();
const target = 's3://nz-flood-map/new-zealand/flood-depth/present-day_1pct/2193/';
const folder = 'stac/new-zealand/flood-depth/present-day_1pct/2193';
const configUrl = 'https://basemaps.linz.govt.nz/?config=any';

before(() => {
  fsa.register('memory://', memory);
});
beforeEach(() => memory.files.clear());

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

  async function importCollection(
    t: TestContext,
    repoName: string,
    options: { items?: string[]; existing?: string[]; preview?: boolean } = {},
  ): Promise<{ files: GithubFiles[]; body: string | undefined }> {
    const items = options.items ?? [];
    const links = items.map((item) => ({ rel: 'item', href: `./${item}` }));
    const collection = { id: 'any-id', title: 'any-title', 'linz:region': 'new-zealand', links };
    await fsa.write(fsa.toUrl('memory://source/collection.json'), Buffer.from(JSON.stringify(collection)));
    if (options.preview !== false) await fsa.write(fsa.toUrl('memory://source/config-url'), Buffer.from(configUrl));
    for (const item of items) await fsa.write(fsa.toUrl(`memory://source/${item}`), Buffer.from('{}'));
    const catalog = {
      links: [{ rel: 'self', href: 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json' }],
    };
    t.mock.method(GithubApi.prototype, 'getContent', () => Promise.resolve(JSON.stringify(catalog)));
    t.mock.method(GithubApi.prototype, 'getBranch', () => Promise.resolve(undefined));
    t.mock.method(GithubApi.prototype, 'listFiles', () => Promise.resolve(options.existing ?? []));
    const pullRequest: { files: GithubFiles[]; body: string | undefined } = { files: [], body: undefined };
    t.mock.method(GithubApi.prototype, 'createPullRequest', (...args: unknown[]) => {
      pullRequest.files = args[2] as GithubFiles[];
      pullRequest.body = args[3] as string | undefined;
      return Promise.resolve(null);
    });

    await commandStacGithubImport.handler({
      config: undefined,
      verbose: false,
      source: fsa.toUrl('memory://source/'),
      target: fsa.toUrl(target),
      repoName,
      copyOption: '--force-no-clobber',
      ticket: '',
    });
    return pullRequest;
  }

  it('should import the collection with the Basemaps preview', async (t) => {
    const { files, body } = await importCollection(t, 'linz/flood-map');

    assert.deepEqual(
      files.map((f) => f.path.replace(/-\d+\.yaml$/, '.yaml')),
      [`${folder}/collection.json`, 'publish-odr-parameters/any-id.yaml'],
    );
    assert.deepEqual(JSON.parse(files[1]?.content ?? ''), {
      source: 'memory://source/',
      target,
      ticket: '',
      copy_option: '--force-no-clobber',
      region: 'new-zealand',
      flatten: 'false',
    });
    assert.equal(
      body,
      [
        `**Basemaps preview link for Visual QA:** [Basemaps 🗺️](${configUrl})`,
        `**ODR destination path:** \`${target}\``,
      ].join('\n'),
    );
  });

  it('should fail without the Basemaps config-url', async (t) => {
    await assert.rejects(importCollection(t, 'linz/flood-map', { preview: false }));
  });

  it('should import the items for linz/flood-map and delete the unlinked ones', async (t) => {
    const { files } = await importCollection(t, 'linz/flood-map', {
      items: ['AB01.json'],
      existing: [`${folder}/AB02.json`],
    });

    assert.deepEqual(
      files.map((f) => `${f.content == null ? '-' : '+'} ${f.path.replace(/-\d+\.yaml$/, '.yaml')}`),
      [
        `+ ${folder}/collection.json`,
        `+ ${folder}/AB01.json`,
        `- ${folder}/AB02.json`,
        '+ publish-odr-parameters/any-id.yaml',
      ],
    );
  });

  it('should only import the collection for linz/imagery', async (t) => {
    const { files } = await importCollection(t, 'linz/imagery', {
      items: ['AB01.json'],
      existing: [`${folder}/AB02.json`],
    });

    assert.deepEqual(
      files.map((f) => f.path.replace(/-\d+\.yaml$/, '.yaml')),
      [`${folder}/collection.json`, 'publish-odr-parameters/any-id.yaml'],
    );
  });
});
