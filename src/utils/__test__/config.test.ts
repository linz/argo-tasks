import linzFormat from '@linzjs/style/oxfmt.config';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { FormatConfig } from 'oxfmt';

import { DEFAULT_FORMAT } from '../config.ts';

describe('DefaultFormat', () => {
  it('should be the same oxfmt format as @linzjs/style', () => {
    const expected: FormatConfig = linzFormat;
    for (const key of Object.keys(DEFAULT_FORMAT) as (keyof FormatConfig)[]) {
      assert.equal(DEFAULT_FORMAT[key], expected[key], `oxfmt.${key}`);
    }
  });
});
