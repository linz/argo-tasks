import assert from 'node:assert';
import { describe, it } from 'node:test';

import { slugify } from '../slugify.js';

describe('slugify', () => {
  it('should pass through output alphabet unchanged', () => {
    assert.equal(slugify('abcdefghijklmnopqrstuvwxyz0123456789_.-'), 'abcdefghijklmnopqrstuvwxyz0123456789_.-');
  });
  it('should lowercase uppercase ASCII characters', () => {
    assert.equal(slugify('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'abcdefghijklmnopqrstuvwxyz');
  });
  it('should replace spaces with hyphens', () => {
    assert.equal(slugify('Upper North Island'), 'upper-north-island');
  });
  it('should remove diacritics', () => {
    assert.equal(slugify('äéìôūÄÉÌÔŪ'), 'aeiouaeiou');
  });
  it('should handle decomposed characters', () => {
    assert.equal(slugify('\u0041\u0304'), 'a');
  });
  it('should treat any unhandled characters as an error', () => {
    assert.throws(
      () => {
        slugify('a\\b//c;\n');
      },
      {
        name: 'UnhandledCharactersError',
        message: 'Unhandled characters: "\\n", "/", ";", "\\"',
        characters: ['\n', '/', ';', '\\'],
      },
    );
  });
});
