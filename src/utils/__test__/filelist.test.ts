import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { TiffLocation } from '../../commands/tileindex-validate/tileindex.validate.ts';
import type { FileListEntryClass } from '../filelist.ts';
import { createFileList } from '../filelist.ts';

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
      console.log(JSON.stringify(result));
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
