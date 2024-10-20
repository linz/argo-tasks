import assert from 'node:assert';
import { describe, it } from 'node:test';

import { FakeCogTiff } from '../../tileindex-validate/__test__/tileindex.validate.data.js';
import { extractEpsg, extractGsd, formatName, generatePath, PathMetadata } from '../path.generate.js';
import { SampleCollection } from './sample.js';

describe('GeneratePathImagery', () => {
  it('Should match - geographic description', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'urban-aerial-photos',
      geographicDescription: 'Napier',
      region: 'hawkes-bay',
      date: '2017-2018',
      gsd: 0.05,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/hawkes-bay/napier_2017-2018_0.05m/rgb/2193/');
  });
  it('Should match - event', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'rural-aerial-photos',
      geographicDescription: 'North Island Weather Event',
      region: 'hawkes-bay',
      date: '2023',
      gsd: 0.25,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/hawkes-bay/north-island-weather-event_2023_0.25m/rgb/2193/');
  });
  it('Should match - no optional metadata', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'urban-aerial-photos',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
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
      category: 'dem',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/auckland/auckland_2023/dem_1m/2193/');
  });
  it('Should match - dsm (no optional metadata)', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-elevation',
      category: 'dsm',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
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
      category: 'satellite-imagery',
      geographicDescription: 'North Island Cyclone Gabrielle',
      region: 'new-zealand',
      date: '2023',
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
      category: 'scanned-aerial-imagery',
      geographicDescription: undefined,
      region: 'wellington',
      date: '1963',
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
      category: 'dem',
      geographicDescription: 'new-zealand',
      region: 'new-zealand',
      date: '',
      gsd: 1,
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/new-zealand/new-zealand/dem_1m/2193/');
  });
});

describe('formatName', () => {
  it('Should match - region', () => {
    assert.equal(formatName('hawkes-bay', undefined), 'hawkes-bay');
  });
  it('Should match - region & geographic description', () => {
    assert.equal(formatName('hawkes-bay', 'Napier'), 'napier');
  });
  it('Should match - region & event', () => {
    assert.equal(formatName('canterbury', 'Christchurch Earthquake'), 'christchurch-earthquake');
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
      category: 'urban-aerial-photos',
      geographicDescription: collection['linz:geographic_description'],
      region: 'manawatu-whanganui',
      date: '2020',
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
      category: 'urban-aerial-photos',
      geographicDescription: collection['linz:geographic_description'],
      region: 'manawatu-whanganui',
      date: '2020',
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
