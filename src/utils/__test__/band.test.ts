import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { Tiff } from '@cogeotiff/core';
import { pathToFileURL } from 'url';

import { createTiff } from '../../commands/common.ts';
import { extractBandInformation } from '../band.ts';

describe('extractBandInformation', () => {
  it('should extract basic band information (8-bit)', async () => {
    const testTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/8b.tiff'));
    const bands = await extractBandInformation(testTiff);
    assert.equal(bands.join(','), 'uint8,uint8,uint8');
  });

  it('should extract basic band information (16-bit)', async () => {
    const testTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/16b.tiff'));
    const bands = await extractBandInformation(testTiff);
    assert.equal(bands.join(','), 'uint16,uint16,uint16');
  });

  it('should extract basic band information (signed 16-bit)', async () => {
    const testTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/16i.tiff'));
    const bands = await extractBandInformation(testTiff);
    assert.equal(bands.join(','), 'int16,int16,int16');
  });

  it('should throw if the tiff has no images', async () => {
    const tiff = { source: { url: new URL('memory:///no-images.tiff') }, images: [] } as unknown as Tiff;
    await assert.rejects(extractBandInformation(tiff), {
      name: 'Error',
      message: "Can't get base image for memory:///no-images.tiff",
    });
  });
});
