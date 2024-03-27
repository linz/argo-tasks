import assert from 'node:assert';
import { describe, it } from 'node:test';

import { randomEnumValue } from './randomizers.js';

describe('randomEnumValue', () => {
  it('should always return the value', () => {
    /**
     * String enums are compiled into a two-way mapping key → value *and* value → key
     * <https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings>, so we need to filter entries to get
     * the actual values.
     */
    enum SingleEntry {
      firstKey = 1,
    }
    assert.equal(randomEnumValue(SingleEntry), 1);
  });
});
