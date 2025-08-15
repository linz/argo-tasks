import assert from 'node:assert';
import { describe, it } from 'node:test';

import { pathToFileURL } from 'url';

// import { tryParseUrl } from '../../commands/common.ts';
import { slugify } from '../slugify.ts';

const slugChars = 'abcdefghijklmnopqrstuvwxyz0123456789_.-';

describe('slugify', () => {
  it('should pass through output alphabet unchanged', () => {
    assert.equal(slugify(slugChars), slugChars);
  });
  it('should pass through random slug unchanged', () => {
    const input = anySlug();
    assert.equal(slugify(slugify(input)), slugify(input));
  });
  it('should lowercase uppercase ASCII characters', () => {
    assert.equal(slugify('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'abcdefghijklmnopqrstuvwxyz');
  });
  it('should replace spaces with hyphens', () => {
    assert.equal(slugify('Upper North Island'), 'upper-north-island');
  });
  it('should remove apostrophes', () => {
    assert.equal(slugify("Hawke's Bay"), 'hawkes-bay');
  });
  it('should replace slashes with hyphens', () => {
    const x = 'Tikitapu/Blue Lake';
    const u = pathToFileURL(x);
    console.log('url', u);
    assert.equal(slugify('Tikitapu/Blue Lake'), 'tikitapu-blue-lake');
  });
  it('should replace commas with hyphens', () => {
    assert.equal(slugify('Omere, Janus or Toby Rock'), 'omere-janus-or-toby-rock');
  });
  it('should replace ampersands with "and"', () => {
    assert.equal(slugify('Gore A&P Showgrounds'), 'gore-a-and-p-showgrounds');
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

export function anySlug(): string {
  const length = 8;
  let result = '';
  for (let counter = 0; counter < length; counter++) {
    result += slugChars.charAt(Math.floor(Math.random() * slugChars.length));
  }
  return result;
}
