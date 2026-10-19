import { describe, it } from 'node:test';

import assert from 'assert';

import { getPacificAucklandYearMonthDay } from '../date.ts';

describe('getPacificAucklandYearMonthDay', () => {
  it('should format as yyyy-mm-dd', () => {
    assert.equal(getPacificAucklandYearMonthDay('2012-12-31T11:00:00Z'), '2013-01-01');
    assert.equal(getPacificAucklandYearMonthDay('2012-12-31T10:59:59Z'), '2012-12-31');
    assert.equal(getPacificAucklandYearMonthDay('2012-06-15T11:59:59Z'), '2012-06-15');
    assert.equal(getPacificAucklandYearMonthDay('2012-06-15T12:00:00Z'), '2012-06-16');
  });

  it('should return undefined for missing input', () => {
    assert.equal(getPacificAucklandYearMonthDay(null), undefined);
    assert.equal(getPacificAucklandYearMonthDay(undefined), undefined);
  });

  it('should return undefined for an unparseable date string', () => {
    assert.equal(getPacificAucklandYearMonthDay('not a date'), undefined);
    assert.equal(getPacificAucklandYearMonthDay(''), undefined);
  });
});
