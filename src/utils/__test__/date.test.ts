import { describe, it } from 'node:test';

import assert from 'assert';

import { getPacificAucklandYearMonthDay } from '../date.js';

describe('getPacificAucklandYearMonthDay', () => {
  it('should format as yyyy-mm-dd', () => {
    assert.equal(getPacificAucklandYearMonthDay('2012-12-31T11:00:00Z'), '2013-01-01');
  });
});
