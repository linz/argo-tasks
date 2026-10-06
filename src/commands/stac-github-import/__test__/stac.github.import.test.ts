import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import type { StacVersion } from 'stac-ts';

import { GithubApi } from '../../../utils/github.ts';
import { commandStacGithubImport, sortLinks } from '../stac.github.import.ts';

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    const randomItem = array[randomIndex] as T;
    const currentItem = array[currentIndex] as T;
    array[currentIndex] = randomItem;
    array[randomIndex] = currentItem;
  }

  return array;
}

describe('sortLinks', () => {
  it('should make root first', () => {
    const links = [
      { rel: 'self', href: './collection.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4643.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4844.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2932.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4750.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4807.json', type: 'application/json' },
      {
        rel: 'root',
        href: 'https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'item', href: './AY31_1000_4809.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4808.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2934.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4744.json', type: 'application/json' },
    ];
    sortLinks(links);
    assert.equal(links[0]?.rel, 'root');
  });

  it('should sort alphabetically the items', () => {
    const links = [
      { rel: 'self', href: './collection.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4643.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4844.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2932.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4750.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4807.json', type: 'application/json' },
      {
        rel: 'root',
        href: 'https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'item', href: './AY31_1000_4809.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4808.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2934.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4744.json', type: 'application/json' },
    ];
    sortLinks(links);
    const items = links.filter((f) => f.rel === 'item').map((f) => f.href);
    assert.deepEqual(items, [
      './AY30_1000_4643.json',
      './AY30_1000_4744.json',
      './AY30_1000_4844.json',
      './AY31_1000_2932.json',
      './AY31_1000_2934.json',
      './AY31_1000_4750.json',
      './AY31_1000_4807.json',
      './AY31_1000_4808.json',
      './AY31_1000_4809.json',
    ]);
  });

  it('should be stable', () => {
    const links = [
      { rel: 'self', href: './collection.json', type: 'application/json' },
      { rel: 'test', href: './AY30_1000_4643.json', type: 'application/json' },
      { rel: 'item', href: './AY30_100_4844.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2932.json', type: 'application/json' },
      { rel: 'item', href: './AY31_10_4750.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4807.json', type: 'application/json' },
      {
        rel: 'root',
        href: 'https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'self', href: './AY31_500_4809.json', type: 'application/json' },
      { rel: 'item', href: './AY32_1000_4808.json', type: 'application/json' },
      { rel: 'root', href: 'https://AZ31_1000_2934.json', type: 'application/json' },
      { rel: 'fake', href: './AY30_1000_4744.json', type: 'application/json' },
    ];

    sortLinks(links);
    const sorted = links.map((f) => f.href);

    for (let i = 0; i < 1000; i++) {
      const shuffled = shuffle(links);
      sortLinks(shuffled);
      assert.deepEqual(
        shuffled.map((f) => f.href),
        sorted,
      );
    }
  });
});

describe('publish ODR parameters', () => {
  it('should include user group and copy option in publish ODR parameters', async (t) => {
    // Pretend GitHub returned a catalog.json containing a self link
    t.mock.method(GithubApi.prototype, 'getContent', () => {
      return Promise.resolve(
        JSON.stringify({
          links: [
            {
              rel: 'self',
              href: 'https://example.com/catalog.json',
              type: 'application/json',
            },
          ],
        }),
      );
    });

    // Prevent a real pull request from being created and record the call
    const createPullRequestMock = t.mock.method(GithubApi.prototype, 'createPullRequest', () => {});

    // Pretend fsa.read() returned a basemaps config URL
    t.mock.method(fsa, 'read', () => {
      return Promise.resolve('https://example.com/basemaps');
    });

    // Pretend fsa.readJson() returned the source STAC collection
    t.mock.method(fsa, 'readJson', () => {
      return Promise.resolve({
        stac_version: '1.0.0' as StacVersion,
        type: 'Collection',
        id: 'b871c4a7-2d8e-4cec-997a-ed755cf542b9',
        title: 'any-title',
        description: 'any-description',
        license: 'any-license',
        'linz:region': 'manawatu-whanganui',
        extent: {
          spatial: { bbox: [[]] },
          temporal: { interval: [[null, null]] },
        },
        links: [],
      });
    });

    // Set up fake GitHub credentials required by GithubApi
    process.env['GITHUB_APP_ID'] = '1';
    process.env['GITHUB_APP_PRIVATE_KEY'] = 'any-github-app-private-key';
    process.env['GITHUB_APP_INSTALLATION_ID'] = '2';

    // Set up the arguments we want to test
    const params = {
      source: new URL('s3://linz-workflows-scratch/2023-04/25-ispi-manawatu-whanganui-2010-2011-0-4m-tttsb/flat/'),
      target: new URL('s3://linz-imagery/manawatu-whanganui/manawatu-whanganui_2010-2011_0.4m/rgb/2193/'),
      repoName: 'linz/imagery',
      copyOption: '--no-clobber',
      userGroup: 'land',
      ticket: '',
      config: undefined,
      verbose: false,
    };

    // Run the handler
    await commandStacGithubImport.handler(params);

    // Check createPullRequest was called once
    assert.equal(createPullRequestMock.mock.callCount(), 1);

    // Get the files passed to createPullRequest
    const createPullRequestCall = createPullRequestMock.mock.calls[0];
    const files = createPullRequestCall?.arguments[2];

    // Find the generated Publish ODR parameters file
    const parametersFile = files?.find((file) => file.path.startsWith('publish-odr-parameters/'));
    assert.ok(parametersFile);

    // Parse the parameters file content
    const parameters = JSON.parse(parametersFile.content) as {
      user_group: string;
      copy_option: string;
    };

    assert.equal(parameters.user_group, 'land');
    assert.equal(parameters.copy_option, '--no-clobber');
  });
});
