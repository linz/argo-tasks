import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import type { TestContext } from 'node:test';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import type { GithubFiles } from '../../../utils/github.ts';
import { GithubApi } from '../../../utils/github.ts';
import { commandStacGithubImport } from '../stac.github.import.ts';

const memory = new FsMemory();
const target = 's3://nz-flood-map/new-zealand/flood-depth/present-day_1pct/2193/';

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
  ): Promise<{ files: GithubFiles[]; body: string | undefined }> {
    const collection = { id: 'any-id', title: 'any-title', 'linz:region': 'new-zealand', links: [] };
    await fsa.write(fsa.toUrl('memory://source/collection.json'), Buffer.from(JSON.stringify(collection)));
    const catalog = {
      links: [{ rel: 'self', href: 'https://nz-flood-map.s3.ap-southeast-2.amazonaws.com/catalog.json' }],
    };
    t.mock.method(GithubApi.prototype, 'getContent', () => Promise.resolve(JSON.stringify(catalog)));
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

  it('should import into linz/flood-map without a Basemaps preview', async (t) => {
    const { files, body } = await importCollection(t, 'linz/flood-map');

    assert.deepEqual(
      files.map((f) => f.path.replace(/-\d+\.yaml$/, '.yaml')),
      ['stac/new-zealand/flood-depth/present-day_1pct/2193/collection.json', 'publish-odr-parameters/any-id.yaml'],
    );
    assert.deepEqual(JSON.parse(files[1]?.content ?? ''), {
      source: 'memory://source/',
      target,
      ticket: '',
      copy_option: '--force-no-clobber',
      region: 'new-zealand',
      flatten: 'false',
    });
    assert.equal(body, `**ODR destination path:** \`${target}\``);
  });

  it('should link the Basemaps preview when config-url exists', async (t) => {
    await fsa.write(fsa.toUrl('memory://source/config-url'), Buffer.from('https://basemaps.linz.govt.nz/?config=any'));

    const { body } = await importCollection(t, 'linz/imagery');

    assert.equal(
      body,
      [
        '**Basemaps preview link for Visual QA:** [Basemaps 🗺️](https://basemaps.linz.govt.nz/?config=any)',
        `**ODR destination path:** \`${target}\``,
      ].join('\n'),
    );
  });
});
