import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { StacCollection } from 'stac-ts';

import { FakeCogTiff } from '../../tileindex-validate/__test__/tileindex.validate.data.js';
import {
  extractEpsg,
  extractGsd,
  generateName,
  generatePath,
  getCategory,
  getDate,
  getEvent,
  getGeographicDescription,
  getRegion,
  PathMetadata,
} from '../path.generate.js';

describe('GeneratePathImagery', () => {
  it('Should match - geographic description', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'urban-aerial-photos',
      geographicDescription: 'Napier',
      region: 'hawkes-bay',
      event: '',
      date: '2017-2018',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-imagery/hawkes-bay/napier_2017-2018_0.05m/rgb/2193/');
  });
  it('Should match - event', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'rural-aerial-photos',
      geographicDescription: '',
      region: 'hawkes-bay',
      event: 'North Island Weather Event',
      date: '2023',
      gsd: '0.25m',
      epsg: 2193,
    };
    assert.equal(
      generatePath(metadata),
      's3://nz-imagery/hawkes-bay/hawkes-bay-north-island-weather-event_2023_0.25m/rgb/2193/',
    );
  });
  it('Should match - no optional metadata', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'urban-aerial-photos',
      geographicDescription: '',
      region: 'auckland',
      event: '',
      date: '2023',
      gsd: '0.3m',
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
      geographicDescription: '',
      region: 'auckland',
      event: '',
      date: '2023',
      gsd: '1m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://nz-elevation/auckland/auckland_2023/dem_1m/2193/');
  });
  const metadata: PathMetadata = {
    targetBucketName: 'nz-elevation',
    category: 'dsm',
    geographicDescription: '',
    region: 'auckland',
    event: '',
    date: '2023',
    gsd: '1m',
    epsg: 2193,
  };
  it('Should match - dsm (no optional metadata)', () => {
    assert.equal(generatePath(metadata), 's3://nz-elevation/auckland/auckland_2023/dsm_1m/2193/');
  });
});

describe('GeneratePathSatelliteImagery', () => {
  it('Should match - geographic description & event', () => {
    const metadata: PathMetadata = {
      targetBucketName: 'nz-imagery',
      category: 'satellite-imagery',
      geographicDescription: 'North Island',
      region: 'new-zealand',
      event: 'Cyclone Gabrielle',
      date: '2023',
      gsd: '0.5m',
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
      geographicDescription: '',
      region: 'wellington',
      event: '',
      date: '1963',
      gsd: '0.5m',
      epsg: 2193,
    };
    assert.throws(() => {
      generatePath(metadata), Error;
    });
  });
});

describe('GenerateName', () => {
  it('Should match - region', () => {
    assert.equal(generateName('hawkes-bay', '', ''), 'hawkes-bay');
  });
  it('Should match - region & geographic description', () => {
    assert.equal(generateName('hawkes-bay', 'Napier', ''), 'napier');
  });
  it('Should match - region & event', () => {
    assert.equal(generateName('canterbury', '', 'Christchurch Earthquake'), 'canterbury-christchurch-earthquake');
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
      extractEpsg(TiffNoEPSG), Error;
    });
  });
  const TiffInvalidEPSG = new FakeCogTiff('s3://path/fake.tiff', { epsg: 2319 });
  it('Should fail - invalid EPSG code', () => {
    assert.throws(() => {
      extractEpsg(TiffInvalidEPSG), Error;
    });
  });
});

describe('gsd', () => {
  const TiffGsd = new FakeCogTiff('s3://path/fake.tiff', {
    resolution: [0.3],
  });
  it('Should return resolution', () => {
    assert.equal(extractGsd(TiffGsd), '0.3m');
  });
  const TiffNoGsd = new FakeCogTiff('s3://path/fake.tiff', {
    resolution: [],
  });
  it('Should fail - unable to find resolution', () => {
    assert.throws(() => {
      extractGsd(TiffNoGsd), Error;
    });
  });
});

describe('category', async () => {
  it('Should return category', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    assert.equal(getCategory(collection), 'urban-aerial-photos');
  });
  it('Should fail - unable to find category', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    delete collection['linz:geospatial_category'];
    assert.throws(() => {
      getCategory(collection), Error;
    });
  });
});

describe('geographicDescription', async () => {
  it('Should return geographic description', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    const gd = getGeographicDescription(collection);
    assert.equal(gd, 'Palmerston North');
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      category: 'urban-aerial-photos',
      geographicDescription: gd,
      region: 'manawatu-whanganui',
      event: '',
      date: '2020',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/manawatu-whanganui/palmerston-north_2020_0.05m/rgb/2193/');
  });
  it('Should return undefined - no geographic description metadata', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    delete collection['linz:geographic_description'];
    const gd = getGeographicDescription(collection);
    assert.equal(gd, undefined);
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      category: 'urban-aerial-photos',
      geographicDescription: gd,
      region: 'manawatu-whanganui',
      event: '',
      date: '2020',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/manawatu-whanganui/manawatu-whanganui_2020_0.05m/rgb/2193/');
  });
  it('Should return undefined - geographic description = null', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    collection['linz:geographic_description'] = null;
    const gd = getGeographicDescription(collection);
    assert.equal(gd, undefined);
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      category: 'urban-aerial-photos',
      geographicDescription: gd,
      region: 'manawatu-whanganui',
      event: '',
      date: '2020',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/manawatu-whanganui/manawatu-whanganui_2020_0.05m/rgb/2193/');
  });
});

describe('event', async () => {
  it('Should return event', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    const event = getEvent(collection);
    assert.equal(event, 'Storm');
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      category: 'urban-aerial-photos',
      geographicDescription: '',
      region: 'nelson',
      event: event,
      date: '2020',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/nelson/nelson-storm_2020_0.05m/rgb/2193/');
  });
  it('Should return undefined - no event metadata', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    delete collection['linz:event_name'];
    const event = getEvent(collection);
    assert.equal(event, undefined);
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      category: 'urban-aerial-photos',
      geographicDescription: '',
      region: 'nelson',
      event: event,
      date: '2020',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/nelson/nelson_2020_0.05m/rgb/2193/');
  });
  it('Should return undefined - event = null', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    collection['linz:event_name'] = null;
    const event = getEvent(collection);
    assert.equal(event, undefined);
    const metadata: PathMetadata = {
      targetBucketName: 'bucket',
      category: 'urban-aerial-photos',
      geographicDescription: '',
      region: 'nelson',
      event: event,
      date: '2020',
      gsd: '0.05m',
      epsg: 2193,
    };
    assert.equal(generatePath(metadata), 's3://bucket/nelson/nelson_2020_0.05m/rgb/2193/');
  });
});

describe('region', async () => {
  it('Should return region', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    assert.equal(getRegion(collection), 'manawatu-whanganui');
  });
  it('Should fail - unable to find region', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    delete collection['linz:region'];
    assert.throws(() => {
      getRegion(collection), Error;
    });
  });
});

describe('date', async () => {
  it('Should return date as single year', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    assert.equal(getDate(collection), '2022');
  });
  it('Should return date as two years', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    collection.extent.temporal.interval[0] = ['2022-12-31T11:00:00Z', '2023-12-31T11:00:00Z'];
    assert.equal(getDate(collection), '2022-2023');
  });
  it('Should fail - unable to retrieve date', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    collection.extent.temporal.interval[0] = [null, null];
    assert.throws(() => {
      getDate(collection), Error;
    });
  });
});
