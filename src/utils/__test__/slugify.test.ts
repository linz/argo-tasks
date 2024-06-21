import assert from 'node:assert';
import { describe, it } from 'node:test';

import { slugify } from '../slugify.js';

const slugChars = 'abcdefghijklmnopqrstuvwxyz0123456789_.-';

void describe('slugify', () => {
  void it('should pass through output alphabet unchanged', () => {
    assert.equal(slugify(slugChars), slugChars);
  });
  void it('should pass through random slug unchanged', () => {
    const input = anySlug();
    assert.equal(slugify(slugify(input)), slugify(input));
  });
  void it('should lowercase uppercase ASCII characters', () => {
    assert.equal(slugify('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'abcdefghijklmnopqrstuvwxyz');
  });
  void it('should replace spaces with hyphens', () => {
    assert.equal(slugify('Upper North Island'), 'upper-north-island');
  });
  void it('should remove apostrophes', () => {
    assert.equal(slugify("Hawke's Bay"), 'hawkes-bay');
  });
  void it('should replace slashes with hyphens', () => {
    assert.equal(slugify('Tikitapu/Blue Lake'), 'tikitapu-blue-lake');
  });
  void it('should replace commas with hyphens', () => {
    assert.equal(slugify('Omere, Janus or Toby Rock'), 'omere-janus-or-toby-rock');
  });
  void it('should replace ampersands with "and"', () => {
    assert.equal(slugify('Gore A&P Showgrounds'), 'gore-a-and-p-showgrounds');
  });
  void it('should collapse multiple hyphens', () => {
    assert.equal(slugify("Butlers 'V' Hut"), 'butlers-v-hut');
  });
  void it('should remove diacritics', () => {
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
  void it('should convert "ø" (U+00F8) and "Ø" (U+00D8) to "o"', () => {
    ['ø', 'Ø'].forEach((value) => {
      assert.equal(slugify(value), 'o');
    });
  });
  void it('should handle decomposed characters', () => {
    assert.equal(slugify('\u0041\u0304'), 'a');
  });
  void it('should treat any unhandled characters as an error', () => {
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

function anySlug(): string {
  const length = 8;
  let result = '';
  for (let counter = 0; counter < length; counter++) {
    result += slugChars.charAt(Math.floor(Math.random() * slugChars.length));
  }
  return result;
}
