import assert from 'node:assert';
import { describe, it } from 'node:test';

import { formatDate, generateSlug, SlugMetadata } from '../stac.setup.js';
import { SampleCollection } from './sample.js';

describe('GenerateSlugImagery', () => {
  it('Should match - geographic description', () => {
    const metadata: SlugMetadata = {
      category: 'urban-aerial-photos',
      geographicDescription: 'Napier',
      region: 'hawkes-bay',
      date: '2017-2018',
      gsd: '0.05',
    };
    assert.equal(generateSlug(metadata), 'napier_2017-2018_0.05m');
  });
  it('Should match - event', () => {
    const metadata: SlugMetadata = {
      category: 'rural-aerial-photos',
      geographicDescription: 'North Island Weather Event',
      region: 'hawkes-bay',
      date: '2023',
      gsd: '0.25',
    };
    assert.equal(generateSlug(metadata), 'north-island-weather-event_2023_0.25m');
  });
  it('Should match - no optional metadata', () => {
    const metadata: SlugMetadata = {
      category: 'urban-aerial-photos',
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
      category: 'dem',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '10',
    };
    assert.equal(generateSlug(metadata), 'auckland_2023');
  });
  it('Should match - dsm (no optional metadata)', () => {
    const metadata: SlugMetadata = {
      category: 'dsm',
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
      category: 'satellite-imagery',
      geographicDescription: 'North Island Cyclone Gabrielle',
      region: 'new-zealand',
      date: '2023',
      gsd: '0.5',
    };
    assert.equal(generateSlug(metadata), 'north-island-cyclone-gabrielle_2023_0.5m');
  });
});

describe('GenerateSlugHistoricImagery', () => {
  it('Should error', () => {
    const metadata: SlugMetadata = {
      category: 'scanned-aerial-imagery',
      geographicDescription: undefined,
      region: 'wellington',
      date: '1963',
      gsd: '1',
    };
    assert.throws(() => {
      generateSlug(metadata);
    }, Error);
  });
});

describe('GenerateSlugDemIgnoringDate', () => {
  it('Should not include the date in the survey name', () => {
    const metadata: SlugMetadata = {
      category: 'dem',
      geographicDescription: 'new-zealand',
      region: 'new-zealand',
      date: '',
      gsd: '10',
    };
    assert.equal(generateSlug(metadata), 'new-zealand');
  });
});

// describe('formatName', () => {
//   it('Should match - region', () => {
//     assert.equal(formatName('hawkes-bay', undefined), 'hawkes-bay');
//   });
//   it('Should match - region & geographic description', () => {
//     assert.equal(formatName('hawkes-bay', 'Napier'), 'napier');
//   });
//   it('Should match - region & event', () => {
//     assert.equal(formatName('canterbury', 'Christchurch Earthquake'), 'christchurch-earthquake');
//   });
// });

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
    const metadata: SlugMetadata = {
      category: 'urban-aerial-photos',
      geographicDescription: collection['linz:geographic_description'],
      region: 'manawatu-whanganui',
      date: '2020',
      gsd: '0.05',
    };
    assert.equal(generateSlug(metadata), 'palmerston-north_2020_0.05m');
  });
  it('Should return undefined - no geographic description metadata', async () => {
    const collection = structuredClone(SampleCollection);

    delete collection['linz:geographic_description'];
    assert.equal(collection['linz:geographic_description'], undefined);
    const metadata: SlugMetadata = {
      category: 'urban-aerial-photos',
      geographicDescription: collection['linz:geographic_description'],
      region: 'manawatu-whanganui',
      date: '2020',
      gsd: '0.05',
    };
    assert.equal(generateSlug(metadata), 'manawatu-whanganui_2020_0.05m');
  });
});

describe('region', () => {
  it('Should return region', async () => {
    const collection = structuredClone(SampleCollection);

    assert.equal(collection['linz:region'], 'manawatu-whanganui');
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
