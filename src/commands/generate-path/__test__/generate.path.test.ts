import assert from 'node:assert';
import { describe, it } from 'node:test';

import { FakeCogTiff } from '../../tileindex-validate/__test__/tileindex.validate.data.js';
import { extractEpsg, extractGsd, generatePath, PathMetadata } from '../path.generate.js';
import { SampleCollection } from './sample.js';

describe('GeneratePathImagery', () => {
  it('Should match - geographic description', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'urban-aerial-photos',
      region: 'hawkes-bay',
      slug: 'napier_2017-2018_0.05m',
      gsd: 0.05,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/hawkes-bay/napier_2017-2018_0.05m/rgb/2193/');
  });
  it('Should match - event', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'rural-aerial-photos',
      region: 'hawkes-bay',
      slug: 'north-island-weather-event_2023_0.25m',
      gsd: 0.25,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/hawkes-bay/north-island-weather-event_2023_0.25m/rgb/2193/');
  });
  it('Should match - no optional metadata', () => {
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

describe('GeneratePathElevation', () => {
  it('Should match - dem (no optional metadata)', () => {
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
  it('Should match - dsm (no optional metadata)', () => {
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
});

describe('GeneratePathSatelliteImagery', () => {
  it('Should match - geographic description & event', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'satellite-imagery',
      region: 'new-zealand',
      slug: 'north-island-cyclone-gabrielle_2023_0.5m',
      gsd: 0.5,
      epsg: 2193,
    };
    assert.equal(
      generatePath(metadata),
      's3://nz-imagery/new-zealand/north-island-cyclone-gabrielle_2023_0.5m/rgb/2193/',
    );
  });
});

describe('GeneratePathHistoricImagery', () => {
  it('Should error', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      geospatialCategory: 'scanned-aerial-imagery',
      region: 'wellington',
      slug: 'napier_2017-2018_0.05m',
      gsd: 0.5,
      epsg: 2193,
    };
    assert.throws(() => {
      generatePath(metadata);
    }, Error);
  });
});

describe('GeneratePathDemIgnoringDate', () => {
  it('Should not include the date in the survey name', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      geospatialCategory: 'dem',
      region: 'new-zealand',
      slug: 'new-zealand',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/new-zealand/new-zealand/dem_1m/2193/');
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

describe('category', () => {
  it('Should return category', async () => {
    const collection = structuredClone(SampleCollection);

    assert.equal(collection['linz:geospatial_category'], 'urban-aerial-photos');
  });
});

describe('geographicDescription', () => {
  it('Should return geographic description', async () => {
    const collection = structuredClone(SampleCollection);

    assert.equal(collection['linz:geographic_description'], 'Palmerston North');
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      geospatialCategory: 'urban-aerial-photos',
      region: 'manawatu-whanganui',
      slug: 'palmerston-north_2020_0.05m',
      gsd: 0.05,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/manawatu-whanganui/palmerston-north_2020_0.05m/rgb/2193/');
  });
  it('Should return undefined - no geographic description metadata', async () => {
    const collection = structuredClone(SampleCollection);

    delete collection['linz:geographic_description'];
    assert.equal(collection['linz:geographic_description'], undefined);
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      geospatialCategory: 'urban-aerial-photos',
      region: 'manawatu-whanganui',
      slug: 'manawatu-whanganui_2020_0.05m',
      gsd: 0.05,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/manawatu-whanganui/manawatu-whanganui_2020_0.05m/rgb/2193/');
  });
});

describe('region', () => {
  it('Should return region', async () => {
    const collection = structuredClone(SampleCollection);

    assert.equal(collection['linz:region'], 'manawatu-whanganui');
  });
});
