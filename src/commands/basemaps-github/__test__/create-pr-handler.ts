import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { afterEach } from 'node:test';

import { ConfigTileSetRaster, TileSetType } from '@basemaps/config/build/config/tile.set.js';
import { EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { StacCollection, StacVersion } from 'stac-ts';

import {
  anyAsciiAlphanumeric,
  anyAsciiPrintableString,
  randomArrayEntry,
  randomEnumValue,
  randomSetEntry,
} from '../../../utils/__test__/randomizers.js';
import { anySlug } from '../../../utils/__test__/slugify.test.js';
import { GithubApi } from '../../../utils/github.js';
import { ConfigType } from '../create-pr.js';
import {
  basemapsCreatePullRequest,
  LinzBasemapsSourceCollectionRel,
  ValidSourceBuckets,
  ValidTargetBuckets,
} from '../create-pr.js';
import { Category } from '../make.cog.github.js';

const originalEnv = Object.assign({}, process.env);

afterEach(() => {
  process.env = originalEnv;
});

await it('basemapsCreatePullRequest.handler should handle S3 target', async (t) => {
  const targetUrl = `s3://${anyValidTargetBucket()}/${anyEpsgCode()}/${anySlug()}`;
  t.mock.method(fsa, 'readJson', () => {
    return Promise.resolve(anyStacCollection());
  });
  process.env['GITHUB_API_TOKEN'] = anyAsciiPrintableString();
  t.mock.method(GithubApi.prototype, 'getContent', () => {
    return Promise.resolve(Buffer.from(JSON.stringify(anyConfigTileSetRaster())));
  });
  t.mock.method(GithubApi.prototype, 'createBranch', () => {});
  t.mock.method(GithubApi.prototype, 'createBlob', () => {});
  t.mock.method(GithubApi.prototype, 'createCommit', () => {});
  t.mock.method(GithubApi.prototype, 'updateBranch', () => {});
  t.mock.method(GithubApi.prototype, 'createPullRequest', () => {});
  const targetUrlsString = JSON.stringify([targetUrl]);

  await basemapsCreatePullRequest.handler({
    target: targetUrlsString,
    repository: `${anyGitHubOwner()}/${anyGitHubRepositoryName()}`,
    verbose: false,
    category: Category.Satellite,
    configType: ConfigType.Raster,
    individual: false,
    vector: false,
    ticket: 'any ticket',
  });
});

function anyStacCollection(): StacCollection {
  return {
    stac_version: '1.0.0' as StacVersion,
    type: 'Collection',
    id: randomUUID(),
    title: anyAsciiPrintableString(),
    description: anyAsciiPrintableString(),
    license: anyAsciiPrintableString(),
    extent: { spatial: { bbox: [[]] }, temporal: { interval: [[null, null]] } },
    links: [
      {
        href: `s3://${anyValidSourceBucket()}/${anyEpsgCode()}/${anySlug()}`,
        rel: LinzBasemapsSourceCollectionRel,
      },
    ],
  };
}

function anyConfigTileSetRaster(): ConfigTileSetRaster {
  return {
    type: TileSetType.Raster,
    format: randomArrayEntry(['avif', 'jpeg', 'png', 'webp']),
    id: randomUUID(),
    layers: [],
    name: anyAsciiPrintableString(),
    title: anyAsciiPrintableString(),
  };
}

function anyValidSourceBucket(): string {
  return randomSetEntry(ValidSourceBuckets);
}

function anyValidTargetBucket(): string {
  return randomSetEntry(ValidTargetBuckets);
}

function anyEpsgCode(): number {
  return randomEnumValue(EpsgCode);
}

function anyGitHubOwner(): string {
  return anyAsciiAlphanumeric();
}

function anyGitHubRepositoryName(): string {
  return anyAsciiAlphanumeric();
}
