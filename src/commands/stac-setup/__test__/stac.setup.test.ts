import assert from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import type { GeospatialDataCategory } from '../../../utils/metadata.ts';
import { MeterAsString } from '../../common.ts';
import type { SlugMetadata } from '../stac.setup.ts';
import { commandStacSetup, formatDate, slugFromMetadata } from '../stac.setup.ts';
import { SampleCollection } from './sample.ts';

describe('stac-setup', () => {
  const mem = new FsMemory();

  before(() => {
    fsa.register('memory://', mem);
  });

  afterEach(() => {
    mem.files.clear();
  });

  const BaseArgs = {
    verbose: false,
    startDate: undefined,
    endDate: undefined,
    endYear: undefined,
    startYear: undefined,
    config: undefined,
    surveyId: undefined,
    odrUrl: '',
    output: fsa.toUrl('memory://tmp/stac-setup/'),
    gsd: '1',
    region: 'gisborne',
    geographicDescription: 'Wairoa',
    geospatialCategory: 'dem',
  };

  it('should retrieve setup from collection', async () => {
    const baseArgs = {
      ...BaseArgs,
      odrUrl: 'memory://collection.json',
      output: fsa.toUrl('memory://tmp/stac-setup/'),
      startYear: '2013',
      endYear: '2014',
      gsd: '1',
      region: 'gisborne',
      geographicDescription: 'Wairoa',
      geospatialCategory: 'dem',
    } as const;
    await fsa.write(fsa.toUrl('memory://collection.json'), JSON.stringify(SampleCollection));
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list(fsa.toUrl('memory://tmp/stac-setup/')));
    files.sort();
    assert.deepStrictEqual(files, [
      fsa.toUrl('memory://tmp/stac-setup/collection-id'),
      fsa.toUrl('memory://tmp/stac-setup/linz-slug'),
    ]);
    const slug = await fsa.read(fsa.toUrl('memory://tmp/stac-setup/linz-slug'));
    assert.strictEqual(slug.toString(), 'palmerston-north_2024_0.3m');
    const collectionId = await fsa.read(fsa.toUrl('memory://tmp/stac-setup/collection-id'));
    assert.strictEqual(collectionId.toString(), '01HGF4RAQSM53Z26Y7C27T1GMB');
  });

  it('should retrieve setup from args', async () => {
    const baseArgs = {
      ...BaseArgs,
      odrUrl: '',
      output: fsa.toUrl('memory://tmp/stac-setup/'),
      startYear: '2013',
      endYear: '2014',
      gsd: '1',
      region: 'gisborne',
      geographicDescription: 'Wairoa',
      geospatialCategory: 'dem',
    } as const;
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list(fsa.toUrl('memory://tmp/stac-setup/')));
    files.sort();
    assert.deepStrictEqual(files, [
      fsa.toUrl('memory://tmp/stac-setup/collection-id'),
      fsa.toUrl('memory://tmp/stac-setup/linz-slug'),
    ]);
    const slug = await fsa.read(fsa.toUrl('memory://tmp/stac-setup/linz-slug'));
    assert.strictEqual(slug.toString(), 'wairoa_2013-2014');
    const collectionId = await fsa.read(fsa.toUrl('memory://tmp/stac-setup/collection-id'));
    assert.notStrictEqual(collectionId.toString(), '01HGF4RAQSM53Z26Y7C27T1GMB');
  });

  it('should not include the date in the slug', async () => {
    const baseArgs = {
      ...BaseArgs,
      odrUrl: '',
      output: fsa.toUrl('memory://tmp/stac-setup/'),
      startYear: '',
      endYear: '',
      gsd: '10',
      region: 'new-zealand',
      geographicDescription: '',
      geospatialCategory: 'dem',
    } as const;
    await commandStacSetup.handler(baseArgs);

    const files = await fsa.toArray(fsa.list(fsa.toUrl('memory://tmp/stac-setup/')));
    files.sort();
    assert.deepStrictEqual(files, [
      fsa.toUrl('memory://tmp/stac-setup/collection-id'),
      fsa.toUrl('memory://tmp/stac-setup/linz-slug'),
    ]);
    const slug = await fsa.read(fsa.toUrl('memory://tmp/stac-setup/linz-slug'));
    assert.strictEqual(slug.toString(), 'new-zealand');
  });

  it('should generate a slug with a survey id', async () => {
    const baseArgs = {
      ...BaseArgs,
      odrUrl: '',
      output: fsa.toUrl('memory://tmp/stac-setup/'),
      startYear: '1982',
      endYear: '1983',
      gsd: '0.375',
      region: 'chatham-islands',
      surveyId: 'SN8066',
      geographicDescription: 'Chatham Islands',
      geospatialCategory: 'scanned-aerial-photos',
    } as const;
    await commandStacSetup.handler(baseArgs);

    const slug = await fsa.read(fsa.toUrl('memory://tmp/stac-setup/linz-slug'));
    assert.equal(String(slug), 'chatham-islands_sn8066_1982-1983_0.375m');
  });

  it('should error if startDate and startYear are both supplied', async () => {
    const baseArgs = {
      ...BaseArgs,
      startYear: '1982',
      startDate: '1982-01-01',
    } as const;
    const ret = await commandStacSetup.handler(baseArgs).catch((e) => String(e));
    assert.equal(ret, 'Error: --start-date and --start-year are mutually exclusive');
  });

  it('should error if endDate and endYear are both supplied', async () => {
    const baseArgs = {
      ...BaseArgs,
      endYear: '1982',
      endDate: '1982-01-01',
    } as const;
    const ret = await commandStacSetup.handler(baseArgs).catch((e) => String(e));
    assert.equal(ret, 'Error: --end-date and --end-year are mutually exclusive');
  });
});

describe('slugFromMetadata', () => {
  it('Should match - urban with geographic description', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'urban-aerial-photos',
      geographicDescription: 'Napier',
      region: 'hawkes-bay',
      date: '2017-2018',
      gsd: '0.05',
    };
    assert.equal(slugFromMetadata(metadata), 'napier_2017-2018_0.05m');
  });
  it('Should match - rural with geographic description', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'rural-aerial-photos',
      geographicDescription: 'North Island Weather Event',
      region: 'hawkes-bay',
      date: '2023',
      gsd: '0.25',
    };
    assert.equal(slugFromMetadata(metadata), 'north-island-weather-event_2023_0.25m');
  });
  it('Should match - region as no optional metadata', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'urban-aerial-photos',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '0.3',
    };
    assert.equal(slugFromMetadata(metadata), 'auckland_2023_0.3m');
  });

  it('Should match - dem (no optional metadata)', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'dem',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '10',
    };
    assert.equal(slugFromMetadata(metadata), 'auckland_2023');
  });
  it('Should match - dsm (no optional metadata)', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'dsm',
      geographicDescription: undefined,
      region: 'auckland',
      date: '2023',
      gsd: '10',
    };
    assert.equal(slugFromMetadata(metadata), 'auckland_2023');
  });
  it('Should error as historic imagery needs a surveyId', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'scanned-aerial-photos',
      geographicDescription: undefined,
      region: 'wellington',
      date: '1963',
      gsd: '1',
    };
    assert.throws(() => {
      slugFromMetadata(metadata);
    }, Error('Historical imagery needs a surveyId'));
  });

  it('Should error as is not a matching geospatial category.', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'not-a-valid-category' as unknown as GeospatialDataCategory,
      geographicDescription: undefined,
      region: 'wellington',
      date: '1963',
      gsd: '1',
    };
    assert.throws(() => {
      slugFromMetadata(metadata);
    }, Error("Slug can't be generated from collection as no matching category: not-a-valid-category."));
  });

  it('Should not include the date in the slug', () => {
    const metadata: SlugMetadata = {
      geospatialCategory: 'dem',
      geographicDescription: 'new-zealand',
      region: 'new-zealand',
      date: '',
      gsd: '10',
    };
    assert.equal(slugFromMetadata(metadata), 'new-zealand');
  });

  it('should support geographicDescription with historical imagery', () => {
    assert.equal(
      slugFromMetadata({
        geospatialCategory: 'scanned-aerial-photos',
        surveyId: 'SN8066',
        region: 'auckland',
        geographicDescription: 'West-Coast',
        gsd: '0.35',
        date: '1982',
      }),
      'west-coast_sn8066_1982_0.35m',
    );
  });
});

describe('formatDate', () => {
  it('Should return date as single year', async () => {
    assert.equal(formatDate('2023', '2023'), '2023');
  });
  it('Should return date as two years', async () => {
    assert.equal(formatDate('2023', '2024'), '2023-2024');
  });
  it('Should only return a date if both are set', () => {
    assert.equal(formatDate(undefined, '2023'), '');
    assert.equal(formatDate('', '2023'), '');

    assert.equal(formatDate('2023', undefined), '');
    assert.equal(formatDate('2023', ''), '');
  });

  it('should format full dates without timezone conversion', () => {
    assert.equal(formatDate('2023-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'), '2023-2024');
    assert.equal(formatDate('2023-01-01', '2024-01-01'), '2023-2024');
  });
});

describe('checkGsd', () => {
  it('Should return GSD unaltered', async () => {
    assert.equal(await MeterAsString.from('0.3'), '0.3');
  });

  it('Should return GSD with trailing m removed', async () => {
    assert.equal(await MeterAsString.from('0.3m'), '0.3');
  });

  it('Should throw error if GSD is not a number', async () => {
    await assert.rejects(async () => await MeterAsString.from('foo'), Error('Invalid value: foo. must be a number.'));
    await assert.rejects(
      async () => await MeterAsString.from('1.4deg'),
      Error('Invalid value: 1.4deg. must be a number.'),
    );
  });
});
