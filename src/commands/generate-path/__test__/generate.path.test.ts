import assert from 'node:assert';
import { describe, it } from 'node:test';

import { SampleCollection } from '../../generate-path/__test__/sample.ts';
import { FakeCogTiff } from '../../tileindex-validate/__test__/tileindex.validate.data.ts';
import type { PathMetadata } from '../path.generate.ts';
import { extractEpsg, extractGsd, generatePath } from '../path.generate.ts';

describe('GeneratePathImagery', () => {
  it('Should match - urban aerial from slug', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'urban-aerial-photos',
      region: 'auckland',
      slug: 'auckland_2023_0.3m',
      gsd: 0.3,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/auckland/auckland_2023_0.3m/rgb/2193/');
  });
});

describe('GeneratePathHillshade', () => {
  it('Should match - hillshade 8m igor', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dem-hillshade-igor',
      region: 'new-zealand',
      slug: 'new-zealand-contour',
      gsd: 8,
      epsg: 2193,
    };
    assert.equal(
      generatePath(metadata),
      's3://nz-elevation/new-zealand/new-zealand-contour/dem-hillshade-igor_8m/2193/',
    );
  });
  it('Should match - hillshade 8m default', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dem-hillshade',
      region: 'new-zealand',
      slug: 'new-zealand-contour',
      gsd: 8,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/new-zealand/new-zealand-contour/dem-hillshade_8m/2193/');
  });
  it('Should match - hillshade 1m igor', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dem-hillshade-igor',
      region: 'new-zealand',
      slug: 'new-zealand',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/new-zealand/new-zealand/dem-hillshade-igor_1m/2193/');
  });
  it('Should match - hillshade 1m default', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dem-hillshade',
      region: 'new-zealand',
      slug: 'new-zealand',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/new-zealand/new-zealand/dem-hillshade_1m/2193/');
  });
});

describe('GeneratePathGeospatialDataCategories', () => {
  it('Should match - dem from slug', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dem',
      region: 'auckland',
      slug: 'auckland_2023',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/auckland/auckland_2023/dem_1m/2193/');
  });
  it('Should match - dsm from slug', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dsm',
      region: 'auckland',
      slug: 'auckland_2023',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/auckland/auckland_2023/dsm_1m/2193/');
  });
  it('Should error - invalid geospatial category', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'not-a-valid-category',
      region: 'wellington',
      slug: 'napier_2017-2018_0.05m',
      gsd: 0.5,
      epsg: 2193,
    };
    assert.throws(() => {
      generatePath(metadata);
    }, Error("Path can't be generated from collection as no matching category for not-a-valid-category."));
  });
  it('Should error - does not support historical aerial photos', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'scanned-aerial-photos',
      region: 'wellington',
      slug: 'napier_2017-2018_0.05m',
      gsd: 0.5,
      epsg: 2193,
    };
    assert.throws(() => {
      generatePath(metadata);
    }, Error('Historic Imagery scanned-aerial-photos is out of scope for automated path generation.'));
  });
});

describe('GeneratePathImagery', () => {
  it('Should match - urban aerial from slug', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'urban-aerial-photos',
      region: 'auckland',
      slug: 'auckland_2023_0.3m',
      gsd: 0.3,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/auckland/auckland_2023_0.3m/rgb/2193/');
  });
});

describe('epsg', () => {
  const TiffEPSG = new FakeCogTiff('s3://path/fake.tiff', {
    epsg: 2193,
  });
  it('Should return EPSG code', () => {
    assert.equal(extractEpsg(TiffEPSG), '2193');
  });
  const TiffNoEPSG = new FakeCogTiff('s3://path/fake.tiff', { epsg: undefined });
  it('Should fail - unable to find EPSG code', () => {
    assert.throws(() => {
      extractEpsg(TiffNoEPSG);
    }, Error);
  });
  const TiffInvalidEPSG = new FakeCogTiff('s3://path/fake.tiff', { epsg: 2319 });
  it('Should fail - invalid EPSG code', () => {
    assert.throws(() => {
      extractEpsg(TiffInvalidEPSG);
    }, Error);
  });
});

describe('gsd', () => {
  const TiffGsd = new FakeCogTiff('s3://path/fake.tiff', {
    resolution: [0.3],
  });
  it('Should return resolution', () => {
    assert.equal(extractGsd(TiffGsd), 0.3);
  });
  const TiffNoGsd = new FakeCogTiff('s3://path/fake.tiff', {
    resolution: [],
  });
  it('Should fail - unable to find resolution', () => {
    assert.throws(() => {
      extractGsd(TiffNoGsd);
    }, Error);
  });
});

describe('metadata from collection', () => {
  it('Should return urban aerial photos path', async () => {
    const collection = structuredClone(SampleCollection);

    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      geospatialCategory: collection['linz:geospatial_category'],
      region: collection['linz:region'],
      slug: collection['linz:slug'],
      gsd: 0.3,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/manawatu-whanganui/palmerston-north_2024_0.3m/rgb/2193/');
  });
});
