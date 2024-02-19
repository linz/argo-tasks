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
  it('should replace apostrophes with hyphens', () => {
    assert.equal(slugify("Hawke's Bay"), 'hawke-s-bay');
  });
  it('should replace slashes with hyphens', () => {
    assert.equal(slugify('Tikitapu/Blue Lake'), 'tikitapu-blue-lake');
  });
  it('should collapse multiple hyphens', () => {
    assert.equal(slugify("Butlers 'V' Hut"), 'butlers-v-hut');
  });
  it('should remove diacritics', () => {
    ['á', 'Á', 'ä', 'Ä', 'ā', 'Ā'].forEach((value) => {
      assert.equal(slugify(value), 'a');
    });
    ['é', 'É', 'ē', 'Ē'].forEach((value) => {
      assert.equal(slugify(value), 'e');
    });
    ['ì', 'Ì', 'ī', 'Ī'].forEach((value) => {
      assert.equal(slugify(value), 'i');
    });
    ['ó', 'Ó', 'ô', 'Ô', 'ö', 'Ö', 'ō', 'Ō'].forEach((value) => {
      assert.equal(slugify(value), 'o');
    });
    ['ü', 'Ü', 'ū', 'Ū'].forEach((value) => {
      assert.equal(slugify(value), 'u');
    });
  });
  it('should convert "ø" (U+00F8) and "Ø" (U+00D8) to "o"', () => {
    ['ø', 'Ø'].forEach((value) => {
      assert.equal(slugify(value), 'o');
    });
  });
  it('should handle decomposed characters', () => {
    assert.equal(slugify('\u0041\u0304'), 'a');
  });
  it('should treat any unhandled characters as an error', () => {
    assert.throws(
      () => {
        slugify('“a\\b//c—;\n”');
      },
      {
        name: 'Error',
        message: 'Unhandled characters: "\\n", ";", "\\", "—", "“", "”"',
        cause: { characters: ['\n', ';', '\\', '—', '“', '”'] },
      },
    );
  });
});
