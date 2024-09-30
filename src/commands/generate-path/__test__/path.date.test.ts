import { describe, it } from 'node:test';

import assert from 'assert';

import { formatDate, getPacificAucklandYearMonthDay } from '../path.date.js';
import { SampleCollection } from './sample.js';

describe('formatDate', () => {
  it('Should return date as single year', async () => {
    const collection = structuredClone(SampleCollection);
    assert.equal(formatDate(collection), '2023');
  });

  it('Should return date as two years', async () => {
    const collection = structuredClone(SampleCollection);

    collection.extent.temporal.interval[0] = ['2022-06-01T11:00:00Z', '2023-06-01T11:00:00Z'];
    assert.equal(formatDate(collection), '2022-2023');
  });

  it('Should use Pacific/Auckland time zone', async () => {
    const collection = structuredClone(SampleCollection);

    collection.extent.temporal.interval[0] = ['2012-12-31T11:00:00Z', '2014-12-30T11:00:00Z'];
    assert.equal(formatDate(collection), '2013-2014');
  });

  it('Should fail - unable to retrieve date', async () => {
    const collection = structuredClone(SampleCollection);

    collection.extent.temporal.interval[0] = [null, null];
    assert.throws(() => {
      formatDate(collection);
    }, Error);
  });

  it('should format as yyyy-mm-dd', () => {
    assert.equal(getPacificAucklandYearMonthDay('2012-12-31T11:00:00Z'), '2013-01-01');
  });
});
