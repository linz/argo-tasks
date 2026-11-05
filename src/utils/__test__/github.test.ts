import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { GithubApi } from '../github.ts';

interface TreeRequest {
  base_tree: string;
  tree: unknown[];
}

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

  it('createTree should add the files with content and delete the files without', async (t) => {
    const gh = new GithubApi('linz/flood-map');
    const requests: TreeRequest[] = [];
    t.mock.method(gh.octokit.rest.git, 'createTree', (request: TreeRequest) => {
      requests.push(request);
      return Promise.resolve({ status: 201, data: { sha: `tree-${requests.length}` } });
    });

    const tree = await gh.createTree(
      [
        { path: 'stac/a/AB01.json', content: '{}' },
        { path: 'stac/a/AB02.json', content: null },
      ],
      'commit-sha',
    );

    assert.equal(tree, 'tree-1');
    assert.deepEqual(requests, [
      {
        owner: 'linz',
        repo: 'flood-map',
        base_tree: 'commit-sha',
        tree: [
          { path: 'stac/a/AB01.json', mode: '100644', type: 'blob', content: '{}' },
          { path: 'stac/a/AB02.json', mode: '100644', type: 'blob', sha: null },
        ],
      },
    ]);
  });

  it('createTree should chain trees of at most 500 files', async (t) => {
    const gh = new GithubApi('linz/flood-map');
    const requests: TreeRequest[] = [];
    t.mock.method(gh.octokit.rest.git, 'createTree', (request: TreeRequest) => {
      requests.push(request);
      return Promise.resolve({ status: 201, data: { sha: `tree-${requests.length}` } });
    });
    const files = [...Array(501).keys()].map((i) => ({ path: `stac/a/${i}.json`, content: '{}' }));

    const tree = await gh.createTree(files, 'commit-sha');

    assert.equal(tree, 'tree-2');
    assert.deepEqual(
      requests.map((r) => [r.base_tree, r.tree.length]),
      [
        ['commit-sha', 500],
        ['tree-1', 1],
      ],
    );
  });
});
