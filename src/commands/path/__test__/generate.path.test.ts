import { fsa } from '@chunkd/fs';
import assert from 'node:assert';
import { describe, it } from 'node:test';
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
} from '../path.generate.js';

describe('GeneratePathImagery', () => {
  it('Should match - geospatial description', () => {
    assert.equal(
      generatePath('nz-imagery', 'urban-aerial-photos', 'Napier', 'hawkes-bay', '', '2017-2018', '0.05m', '2193'),
      's3://nz-imagery/hawkes-bay/napier_2017-2018_0.05m/rgb/2193/',
    );
  });
  it('Should match - event', () => {
    assert.equal(
      generatePath(
        'nz-imagery',
        'rural-aerial-photos',
        '',
        'hawkes-bay',
        'North Island Weather Event',
        '2023',
        '0.25m',
        '2193',
      ),
      's3://nz-imagery/hawkes-bay/hawkes-bay-north-island-weather-event_2023_0.25m/rgb/2193/',
    );
  });
  it('Should match - no optional metadata', () => {
    assert.equal(
      generatePath('nz-imagery', 'urban-aerial-photos', '', 'auckland', '', '2023', '0.3m', '2193'),
      's3://nz-imagery/auckland/auckland_2023_0.3m/rgb/2193/',
    );
  });
});

describe('GeneratePathElevation', () => {
  it('Should match - dem (no optional metadata)', () => {
    assert.equal(
      generatePath('nz-elevation', 'dem', '', 'auckland', '', '2023', '1m', '2193'),
      's3://nz-elevation/auckland/auckland_2023/dem_1m/2193/',
    );
  });
  it('Should match - dsm (no optional metadata)', () => {
    assert.equal(
      generatePath('nz-elevation', 'dsm', '', 'auckland', '', '2023', '1m', '2193'),
      's3://nz-elevation/auckland/auckland_2023/dsm_1m/2193/',
    );
  });
});

describe('GeneratePathSatelliteImagery', () => {
  it('Should match - geospatial description & event', () => {
    assert.equal(
      generatePath(
        'nz-imagery',
        'satellite-imagery',
        'North Island',
        'new-zealand',
        'Cyclone Gabrielle',
        '2023',
        '0.5m',
        '2193',
      ),
      's3://nz-imagery/new-zealand/north-island-cyclone-gabrielle_2023_0.5m/rgb/2193/',
    );
  });
});

describe('GeneratePathHistoricImagery', () => {
  it('Should error', () => {
    assert.throws(() => {
      generatePath('nz-imagery', 'scanned-aerial-imagery', '', 'wellington', '', '1963', '0.5m', '2193'), Error;
    });
  });
});

describe('GenerateName', () => {
  it('Should match - region', () => {
    assert.equal(generateName('hawkes-bay', '', ''), 'hawkes-bay');
  });
  it('Should match - region & geospatial description', () => {
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

describe('geospatialDescription', async () => {
  it('Should return geographic description', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    assert.equal(getGeographicDescription(collection), 'Palmerston North');
  });
  it('Should return undefined for geographic description', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    delete collection['linz:geographic_description'];
    assert.equal(getGeographicDescription(collection), undefined);
  });
});

describe('event', async () => {
  it('Should return event', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    assert.equal(getEvent(collection), 'Storm');
  });
  it('Should return undefined for event', async () => {
    const collection = await fsa.readJson<StacCollection>('./src/commands/path/__test__/sample.json');
    delete collection['linz:event_name'];
    assert.equal(getEvent(collection), undefined);
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
