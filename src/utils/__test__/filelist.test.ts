import assert from 'node:assert';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { fsa } from '@chunkd/fs';

import type { TiffLocation } from '../../commands/tileindex-validate/tileindex.validate.ts';
import type { FileListEntryClass } from '../filelist.ts';
import { encodePercentSigns } from '../filelist.ts';
import { makeRelative } from '../filelist.ts';
import { createFileList, protocolAwareString } from '../filelist.ts';

describe('createFileList', () => {
  const complexLocation = new URL(`memory://username@input2:3030/🦄🌈.tiff?query=foo#@1234`);
  const simpleLocation = new URL('memory://input1');

  const locationTestOne: TiffLocation = {
    bands: [],
    bbox: [0, 0, 0, 0],
    tileNames: [],
    source: new URL('memory://input1'),
  };
  const locationTestTwo: TiffLocation = {
    bands: [],
    bbox: [0, 0, 0, 0],
    tileNames: [],
    source: new URL(complexLocation),
  };
  const entries = new Map<string, TiffLocation[]>([
    ['output1', [locationTestOne, locationTestTwo]],
    ['output2', [locationTestTwo]],
  ]);

  it('should create a file list from TiffLocation and string inputs with derived inputs set based on input flag', () => {
    for (const includeDerived of [true, false]) {
      const result: FileListEntryClass[] = createFileList(entries, includeDerived);
      assert.deepEqual(result, [
        {
          output: 'output1',
          input: [simpleLocation, complexLocation],
          includeDerived: includeDerived,
        },
        {
          output: 'output2',
          input: [complexLocation],
          includeDerived: includeDerived,
        },
      ]);
    }
  });

  it('should handle empty entries map', () => {
    const entries = new Map<string, TiffLocation[]>();
    const includeDerived = false;

    const result: FileListEntryClass[] = createFileList(entries, includeDerived);

    assert.deepEqual(result, []);
  });
});

describe('URL handling with special characters', () => {
  it('should handle special characters correctly through fsa.toUrl and protocolAwareString', () => {
    const testCases = [
      {
        original:
          's3://linz-topographic-upload/landpro/Gisborne_2023/Non_Priority_3/VECTOR/EP#462_Gisborne_LOT_15-16-17.dgn',
        expectedTransformed:
          's3://linz-topographic-upload/landpro/Gisborne_2023/Non_Priority_3/VECTOR/EP%23462_Gisborne_LOT_15-16-17.dgn',
      },
      {
        original:
          's3://linz-hydrographic-archive/Authoritative_Surveys/HS72_Taranaki/Processed_Data/3_Processed/1_GSF_PROJECTS/HS72_Block M_GSF Project/SD/HS72_M_95%_C.I_4m_39-110m.sd',
        expectedTransformed:
          's3://linz-hydrographic-archive/Authoritative_Surveys/HS72_Taranaki/Processed_Data/3_Processed/1_GSF_PROJECTS/HS72_Block M_GSF Project/SD/HS72_M_95%25_C.I_4m_39-110m.sd',
      },
      {
        original:
          's3://linz-topographic-archive/landpro/Gisborne_2023/Non_Priority_3/VECTOR/EP#462_Gisborne_LOT_15-16-17.dgn',
        expectedTransformed:
          's3://linz-topographic-archive/landpro/Gisborne_2023/Non_Priority_3/VECTOR/EP%23462_Gisborne_LOT_15-16-17.dgn',
      },
      {
        original: 'memory://test/file#with#hash.txt',
        expectedTransformed: 'memory://test/file%23with%23hash.txt',
      },
      {
        original: 'memory://test/file with spaces.txt',
        expectedTransformed: 'memory://test/file with spaces.txt',
      },
      {
        original: 'memory://test/file[brackets].txt',
        expectedTransformed: 'memory://test/file[brackets].txt',
      },
      {
        original: 'memory://test/file(parens).txt',
        expectedTransformed: 'memory://test/file(parens).txt',
      },
      {
        original: 'https://example.com/path/file#fragment',
        expectedTransformed: 'https://example.com/path/file#fragment',
      },
      {
        original: 'http://example.com/path/file#anchor',
        expectedTransformed: 'http://example.com/path/file#anchor',
      },
    ];

    for (const testCase of testCases) {
      // This is what happens in the CopyValidator
      const url1 = fsa.toUrl(testCase.original);
      const transformedPath = protocolAwareString(url1);

      // This is what happens in the copy worker
      const url2 = fsa.toUrl(transformedPath);

      // For paths with # characters, they should be encoded as %23
      assert.equal(
        transformedPath,
        testCase.expectedTransformed,
        `Transformation failed. Original: ${testCase.original}, Got: ${transformedPath}, Expected: ${testCase.expectedTransformed}`,
      );

      const expectedFinalUrl = fsa.toUrl(testCase.expectedTransformed).href;
      assert.equal(
        url2.href,
        expectedFinalUrl,
        `URL re-parsing failed. Original: ${testCase.original}, Final URL: ${url2.href}, Expected: ${expectedFinalUrl}`,
      );
    }
  });
});

describe('makeRelative', () => {
  it('should make relative urls', () => {
    assert.equal(
      makeRelative(fsa.toUrl('s3://linz-imagery/'), fsa.toUrl('s3://linz-imagery/catalog.json')),
      './catalog.json',
    );
  });

  it('should make relative from absolute paths', () => {
    assert.equal(
      makeRelative(pathToFileURL('/home/blacha/'), pathToFileURL('/home/blacha/catalog.json')),
      './catalog.json',
    );
  });

  it('should make relative relative paths', () => {
    assert.equal(makeRelative(pathToFileURL(process.cwd() + '/'), pathToFileURL('./catalog.json')), './catalog.json');
  });

  it('should not make relative on different paths', () => {
    assert.throws(() => makeRelative(pathToFileURL('/home/blacha/'), pathToFileURL('/home/test/catalog.json')), Error);
  });

  it('should handle URLs with spaces', () => {
    const base = new URL('s3://bucket/path/');
    const fileWithSpace = new URL('s3://bucket/path/with%20space/file.txt');
    assert.equal(makeRelative(base, fileWithSpace), './with space/file.txt');
  });

  it('should handle URLs with special characters', () => {
    const base = new URL('memory://bucket/path/');
    const fileWithHash = new URL('memory://bucket/path/file%23hash.txt');
    const fileWithBracket = new URL('memory://bucket/path/file[bracket].txt');
    assert.equal(makeRelative(base, fileWithHash), './file#hash.txt');
    assert.equal(makeRelative(base, fileWithBracket), './file[bracket].txt');
  });

  it('should handle file with percent sign (not followed by two hex digits)', () => {
    const base = new URL('s3://bucket/path/');
    const tricky = new URL('s3://bucket/path/95%_C.I_4m_40-110m.sd');
    assert.equal(makeRelative(base, tricky), './95%_C.I_4m_40-110m.sd');
  });

  it('should throw if strict and not a subfolder', () => {
    const base = new URL('s3://bucket/path/');
    const outside = new URL('s3://bucket/other/file.txt');
    assert.throws(() => makeRelative(base, outside, true));
  });
});

describe('encodePercentSigns', () => {
  it('should encode lone percent signs', () => {
    assert.equal(encodePercentSigns('HS72_M_95%_C.I_4m_39-110m.sd'), 'HS72_M_95%25_C.I_4m_39-110m.sd');
    assert.equal(encodePercentSigns('%foo%'), '%25foo%25');
  });

  it('should not encode percent signs followed by two hex digits', () => {
    assert.equal(encodePercentSigns('foo%20bar'), 'foo%20bar');
    assert.equal(encodePercentSigns('%41%42%43'), '%41%42%43');
  });

  it('should encode percent signs not followed by two hex digits', () => {
    assert.equal(encodePercentSigns('foo%2Gbar'), 'foo%252Gbar');
    assert.equal(encodePercentSigns('foo%'), 'foo%25');
  });
});
