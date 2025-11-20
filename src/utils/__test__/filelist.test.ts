import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import type { TiffLocation } from '../../commands/tileindex-validate/tileindex.validate.ts';
import type { FileListEntryClass } from '../filelist.ts';
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
