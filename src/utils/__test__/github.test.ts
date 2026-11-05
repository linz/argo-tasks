import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { Blob } from '../github.ts';
import { GithubApi } from '../github.ts';

describe('GithubApi', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['GITHUB_APP_ID'] = '1';
    process.env['GITHUB_APP_PRIVATE_KEY'] = 'any-github-app-private-key';
    process.env['GITHUB_APP_INSTALLATION_ID'] = '2';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('listFiles should only list the files directly inside the folder', async (t) => {
    const gh = new GithubApi('linz/flood-map');
    const tree = [
      { path: 'stac/a/collection.json', type: 'blob' },
      { path: 'stac/a/AB01.json', type: 'blob' },
      { path: 'stac/a/sub', type: 'tree' },
      { path: 'stac/a/sub/AB02.json', type: 'blob' },
      { path: 'stac/ab/collection.json', type: 'blob' },
    ];
    t.mock.method(gh.octokit.rest.git, 'getTree', () =>
      Promise.resolve({ status: 200, data: { truncated: false, tree } }),
    );

    assert.deepEqual(await gh.listFiles('master', 'stac/a'), ['stac/a/collection.json', 'stac/a/AB01.json']);
  });

  it('listFiles should fail on a truncated tree', async (t) => {
    const gh = new GithubApi('linz/flood-map');
    t.mock.method(gh.octokit.rest.git, 'getTree', () =>
      Promise.resolve({ status: 200, data: { truncated: true, tree: [] } }),
    );

    await assert.rejects(gh.listFiles('master', 'stac/a'), /too large/);
  });

  it('createPullRequest should delete the files without content', async (t) => {
    const commits: Blob[][] = [];
    t.mock.method(GithubApi.prototype, 'getBranch', () => Promise.resolve('any-sha'));
    t.mock.method(GithubApi.prototype, 'createBlob', (content: string, path: string) =>
      Promise.resolve({ path, mode: '100644', type: 'blob', sha: `sha-${content}` }),
    );
    t.mock.method(GithubApi.prototype, 'createCommit', (blobs: Blob[]) => {
      commits.push(blobs);
      return Promise.resolve('any-commit-sha');
    });
    t.mock.method(GithubApi.prototype, 'updateBranch', () => Promise.resolve());
    const gh = new GithubApi('linz/flood-map');
    t.mock.method(gh.octokit.rest.pulls, 'create', () =>
      Promise.resolve({ status: 201, data: { number: 1, html_url: 'https://github.com/linz/flood-map/pull/1' } }),
    );

    const pr = await gh.createPullRequest('feat/bot', 'feat: import', [
      { path: 'stac/a/AB01.json', content: '{}' },
      { path: 'stac/a/AB02.json', content: null },
    ]);

    assert.equal(pr, 1);
    assert.deepEqual(commits, [
      [
        { path: 'stac/a/AB01.json', mode: '100644', type: 'blob', sha: 'sha-{}' },
        { path: 'stac/a/AB02.json', mode: '100644', type: 'blob', sha: null },
      ],
    ]);
  });
});
