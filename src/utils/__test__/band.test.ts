import assert from 'node:assert';
import { describe, it } from 'node:test';

import { createTiff } from '../../commands/common.js';
import { extractBandInformation } from '../band.js';

describe('extractBandInformation', () => {
  it('should extract basic band information (8-bit)', async () => {
    const testTiff = await createTiff('./src/commands/tileindex-validate/__test__/data/8b.tiff');
    const bands = await extractBandInformation(testTiff);
    assert.equal(bands.join(','), 'uint8,uint8,uint8');
  });

  it('should extract basic band information (16-bit)', async () => {
    const testTiff = await createTiff('./src/commands/tileindex-validate/__test__/data/16b.tiff');
    const bands = await extractBandInformation(testTiff);
    assert.equal(bands.join(','), 'uint16,uint16,uint16');
  });
});
