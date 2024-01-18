import assert from 'node:assert';
import { describe, it } from 'node:test';

import { slugify } from '../slugify.js';

const outputAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789_.-';

describe('slugify', () => {
  it('should pass through output alphabet unchanged', () => {
    assert.equal(slugify(outputAlphabet), outputAlphabet);
  });
  it('should lowercase uppercase ASCII characters', () => {
    assert.equal(slugify('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'abcdefghijklmnopqrstuvwxyz');
  });
});
