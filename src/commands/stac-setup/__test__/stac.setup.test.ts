import assert from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { commandStacSetup } from '../stac.setup.js';
import { formatDate, generateSlug, SlugMetadata } from '../stac.setup.js';
import { SampleCollection } from './sample.js';

describe('stac-setup', () => {
  const mem = new FsMemory();

  before(() => {
    fsa.register('memory://', mem);
  });

  afterEach(() => {
    mem.files.clear();
  });

  it('should retrieve setup from collection', async () => {
    const baseArgs = {
      addDateInSlug: true,
      odrUrl: 'memory://collection.json',
      output: new URL('memory://tmp/stac-setup/'),
      verbose: false,
      startDate: '2013-11-17',
      endDate: '2014-02-14',
      gsd: '1',
      region: 'gisborne',
      geographicDescription: 'Wairoa',
      geospatialCategory: 'dem',
      config: undefined,
    } as const;
    await fsa.write('memory://collection.json', JSON.stringify(structuredClone(SampleCollection)));
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list('memory://tmp/stac-setup/'));
    files.sort();
    assert.deepStrictEqual(files, ['memory://tmp/stac-setup/collection-id', 'memory://tmp/stac-setup/linz-slug']);
    const slug = await fsa.read('memory://tmp/stac-setup/linz-slug');
    assert.strictEqual(slug.toString(), 'palmerston-north_2024_0.3m');
    const collectionId = await fsa.read('memory://tmp/stac-setup/collection-id');
    assert.strictEqual(collectionId.toString(), '01HGF4RAQSM53Z26Y7C27T1GMB');
  });

  it('should retrieve setup from args', async () => {
    const baseArgs = {
      addDateInSlug: true,
      odrUrl: '',
      output: new URL('memory://tmp/stac-setup/'),
      verbose: false,
      startDate: '2013-11-17',
      endDate: '2014-02-14',
      gsd: '1',
      region: 'gisborne',
      geographicDescription: 'Wairoa',
      geospatialCategory: 'dem',
      config: undefined,
    } as const;
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list('memory://tmp/stac-setup/'));
    files.sort();
    assert.deepStrictEqual(files, ['memory://tmp/stac-setup/collection-id', 'memory://tmp/stac-setup/linz-slug']);
    const slug = await fsa.read('memory://tmp/stac-setup/linz-slug');
    assert.strictEqual(slug.toString(), 'wairoa_2013-2014');
    const collectionId = await fsa.read('memory://tmp/stac-setup/collection-id');
    assert.notStrictEqual(collectionId.toString(), '01HGF4RAQSM53Z26Y7C27T1GMB');
  });

  it('should not include the date in the slug', async () => {
    const baseArgs = {
      addDateInSlug: false,
      odrUrl: '',
      output: new URL('memory://tmp/stac-setup/'),
      verbose: false,
      startDate: '2013-11-17',
      endDate: '2014-02-14',
      gsd: '10',
      region: 'new-zealand',
      geographicDescription: '',
      geospatialCategory: 'dem',
      config: undefined,
    } as const;
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list('memory://tmp/stac-setup/'));
    files.sort();
    assert.deepStrictEqual(files, ['memory://tmp/stac-setup/collection-id', 'memory://tmp/stac-setup/linz-slug']);
    const slug = await fsa.read('memory://tmp/stac-setup/linz-slug');
    assert.strictEqual(slug.toString(), 'new-zealand');
  });

  it('should retrieve setup from collection ignoring addDateInSlug flag', async () => {
    const baseArgs = {
      addDateInSlug: false,
      odrUrl: 'memory://collection.json',
      output: new URL('memory://tmp/stac-setup/'),
      verbose: false,
      startDate: '2013-11-17',
      endDate: '2014-02-14',
      gsd: '1',
      region: 'gisborne',
      geographicDescription: 'Wairoa',
      geospatialCategory: 'dem',
      config: undefined,
    } as const;
    await fsa.write('memory://collection.json', JSON.stringify(structuredClone(SampleCollection)));
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list('memory://tmp/stac-setup/'));
    files.sort();
    assert.deepStrictEqual(files, ['memory://tmp/stac-setup/collection-id', 'memory://tmp/stac-setup/linz-slug']);
    const slug = await fsa.read('memory://tmp/stac-setup/linz-slug');
    assert.strictEqual(slug.toString(), 'palmerston-north_2024_0.3m');
  });
});

describe('GenerateSlugImagery', () => {
  it('Should match - urban with geographic description', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'urban-aerial-photos',
      geographicDescription: 'Napier',
      region: 'hawkes-bay',
      date: '2017-2018',
      gsd: '0.05',
    };
    assert.equal(generateSlug(metadata), 'napier_2017-2018_0.05m');
  });
  it('Should match - rural with geographic description', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'rural-aerial-photos',
      geographicDescription: 'North Island Weather Event',
      region: 'hawkes-bay',
      date: '2023',
      gsd: '0.25',
    };
    assert.equal(generateSlug(metadata), 'north-island-weather-event_2023_0.25m');
  });
  it('Should match - region as no optional metadata', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'urban-aerial-photos',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '0.3',
    };
    assert.equal(generateSlug(metadata), 'auckland_2023_0.3m');
  });
});

describe('GenerateSlugElevation', () => {
  it('Should match - dem (no optional metadata)', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'dem',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '10',
    };
    assert.equal(generateSlug(metadata), 'auckland_2023');
  });
  it('Should match - dsm (no optional metadata)', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'dsm',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '10',
    };
    assert.equal(generateSlug(metadata), 'auckland_2023');
  });
});

describe('GenerateSlugSatelliteImagery', () => {
  it('Should match - geographic description & event', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'satellite-imagery',
      geographicDescription: 'North Island Cyclone Gabrielle',
      region: 'new-zealand',
      date: '2023',
      gsd: '0.5',
    };
    assert.equal(generateSlug(metadata), 'north-island-cyclone-gabrielle_2023_0.5m');
  });
});

describe('GenerateSlugHistoricImagery', () => {
  it('Should error as historic imagery geospatial category is not supported', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'scanned-aerial-photos',
      geographicDescription: undefined,
      region: 'wellington',
      date: '1963',
      gsd: '1',
    };
    assert.throws(() => {
      generateSlug(metadata);
    }, Error('Automated slug generation not implemented for historic imagery.'));
  });
});

describe('GenerateSlugUnknownGeospatialCategory', () => {
  it('Should error as is not a matching geospatial category.', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'scanned-aerial-imagery',
      geographicDescription: undefined,
      region: 'wellington',
      date: '1963',
      gsd: '1',
    };
    assert.throws(() => {
      generateSlug(metadata);
    }, Error("Slug can't be generated from collection as no matching category: scanned-aerial-imagery."));
  });
});

describe('GenerateSlugDemIgnoringDate', () => {
  it('Should not include the date in the slug', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'dem',
      geographicDescription: 'new-zealand',
      region: 'new-zealand',
      date: '',
      gsd: '10',
    };
    assert.equal(generateSlug(metadata), 'new-zealand');
  });
});

describe('formatDate', () => {
  it('Should return date as single year', async () => {
    const startDate = '2023-01-02';
    const endDate = '2023-02-02';
    assert.equal(formatDate(startDate, endDate), '2023');
  });

  it('Should return date as two years', async () => {
    const startDate = '2023-01-02';
    const endDate = '2024-02-02';
    assert.equal(formatDate(startDate, endDate), '2023-2024');
  });
});
