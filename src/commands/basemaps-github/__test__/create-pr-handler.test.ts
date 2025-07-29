import assert from 'node:assert';
import { afterEach, it } from 'node:test';

import { TileSetType } from '@basemaps/config/build/config/tile.set.js';
import { EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import type { StacVersion } from 'stac-ts';

import { anySlug } from '../../../utils/__test__/slugify.test.ts';
import { GithubApi } from '../../../utils/github.ts';
import { basemapsCreatePullRequest, LinzBasemapsSourceCollectionRel } from '../create-pr.ts';

const originalEnv = Object.assign({}, process.env);

afterEach(() => {
  process.env = originalEnv;
});

await it('basemapsCreatePullRequest.handler should handle S3 target', async (t) => {
  const targetUrl = `s3://linz-basemaps/${EpsgCode.Nztm2000}/${anySlug()}`;
  t.mock.method(fsa, 'readJson', () => {
    return Promise.resolve({
      stac_version: '1.0.0' as StacVersion,
      type: 'Collection',
      id: 'b871c4a7-2d8e-4cec-997a-ed755cf542b9',
      title: 'any-title',
      description: 'any-description',
      license: 'any-license',
      extent: { spatial: { bbox: [[]] }, temporal: { interval: [[null, null]] } },
      links: [
        {
          href: `s3://nz-imagery/${EpsgCode.Wgs84}/${anySlug()}`,
          rel: LinzBasemapsSourceCollectionRel,
        },
      ],
    });
  });
  process.env['GITHUB_API_TOKEN'] = 'any-github-api-token';
  t.mock.method(GithubApi.prototype, 'getContent', () => {
    return Promise.resolve(
      Buffer.from(
        JSON.stringify({
          type: TileSetType.Raster,
          format: 'avif',
          id: 'b48e08c3-ccef-4b42-870a-9c357cb15d1c',
          layers: [],
          name: 'any-name',
          title: 'any-title',
        }),
      ),
    );
  });
  t.mock.method(GithubApi.prototype, 'createBranch', () => {});
  t.mock.method(GithubApi.prototype, 'createBlob', () => {});
  t.mock.method(GithubApi.prototype, 'createCommit', () => {});
  t.mock.method(GithubApi.prototype, 'updateBranch', () => {});
  const createPullRequestMock = t.mock.method(GithubApi.prototype, 'createPullRequest', () => {});
  const targetUrlsString = JSON.stringify([targetUrl]);

  const result = await basemapsCreatePullRequest.handler({
    target: targetUrlsString,
    repository: 'any-owner/any-repository',
    verbose: false,
    category: 'Satellite Imagery',
    configType: 'raster',
    individual: false,
    vector: false,
    ticket: 'any ticket',
    content: 'any-content',
  });
  assert.equal(result, undefined);
  assert.equal(createPullRequestMock.mock.callCount(), 1);
});
