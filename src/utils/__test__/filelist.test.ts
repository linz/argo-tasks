import assert from 'node:assert';
import { describe, it } from 'node:test';

import { TiffLocation } from "../../commands/tileindex-validate/tileindex.validate.ts";
import { createFileList, FileListEntry } from "../filelist.ts";

describe('createFileList', () => {
  const locationTestOne: TiffLocation = { bands: [], bbox: [0, 0, 0, 0], tileNames: [], source: 'input1' };
  const locationTestTwo: TiffLocation = { bands: [], bbox: [0, 0, 0, 0], tileNames: [], source: 'input2' };
  const entries = new Map<string, TiffLocation[] | string[]>([
    ['output1', [locationTestOne, locationTestTwo]],
    ['output2', ['input3', 'input4']],
  ]);

  it('should create a file list from TiffLocation and string inputs with derived inputs set based on input flag', () => {
    for (const includeDerived of [true, false]) {
      const result: FileListEntry[] = createFileList(entries, includeDerived);

      assert.deepEqual(result, [
        {
          output: 'output1',
          input: ['input1', 'input2'],
          includeDerived: includeDerived,
        },
        {
          output: 'output2',
          input: ['input3', 'input4'],
          includeDerived: includeDerived,
        },
      ]);
    }
  });

  it('should handle empty entries map', () => {
    const entries = new Map<string, TiffLocation[] | string[]>();
    const includeDerived = false;

    const result: FileListEntry[] = createFileList(entries, includeDerived);

    assert.deepEqual(result, []);
  });
});
