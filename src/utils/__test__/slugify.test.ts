import assert from 'node:assert';
import { describe, it } from 'node:test';

import { outputAlphabet, slugify } from '../slugify.js';

describe('slugify', () => {
  it('should pass through output alphabet unchanged', () => {
    assert.equal(slugify(outputAlphabet), outputAlphabet);
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
        slugify('a\\b//c');
      },
      {
        name: 'UnhandledCharactersError',
        message: 'Unhandled characters: "/", "\\"',
        characters: ['/', '\\'],
      },
    );
  });
});
