import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';
import { Source, Tiff, TiffImage } from '@cogeotiff/core';

import { createTiff } from '../../commands/common.js';
import { findBoundingBox, parseTfw, PixelIsPoint } from '../geotiff.js';

describe('geotiff', () => {
  describe('parseTfw', () => {
    it('should parse tfw', () => {
      const output = parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375\n5079479.9625`);
      assert.deepEqual(output, { scale: { x: 0.075, y: -0.075 }, origin: { x: 1460800, y: 5079480 } });
    });

    it('should fail on invalid numbers', () => {
      assert.throws(() => parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375`)); // Too Short
      assert.throws(() => parseTfw(`0.075a\n0\n0\n-0.075\n1460800.0375\n5079479.9625`)); // scaleX number is NaN
      assert.throws(() => parseTfw(`0.075\n0\n0\n-0.075a\n1460800.0375\n5079479.9625`)); // scaleY number is NaN
      assert.throws(() => parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375a\n5079479.9625`)); // originX number is NaN
      assert.throws(() => parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375\n5079479.9625a`)); // originY number is NaN
    });

    it('should fail on invalid input', () => {
      assert.throws(() => parseTfw(null as unknown as string));
    });

    it('should not allow rotations or skews', () => {
      assert.throws(() => parseTfw(`0.075\n1\n0\n-0.075\n1460800.0375\n5079479.9625`)); // Y Rotation
      assert.throws(() => parseTfw(`0.075\n0\n1\n-0.075\n1460800.0375\n5079479.9625`)); // X Rotation
    });
  });

  it('should parse tiff location', async () => {
    const source = new FsMemory();
    // Actual tiff file
    await source.write(
      fsa.toUrl('memory://BX20_500_023098.tif'),
      Buffer.from(
        '49492a00080000001100000103000100' +
          '0000800c00000101030001000000c012' +
          '00000201030003000000ea0000000301' +
          '03000100000001000000060103000100' +
          '00000200000015010300010000000300' +
          '00001a01050001000000da0000001b01' +
          '050001000000e20000001c0103000100' +
          '00000100000028010300010000000200' +
          '00004201030001000000000800004301' +
          '03000100000000080000440104000600' +
          '0000080100004501040006000000f000' +
          '00005301030003000000200100000e83' +
          '0c00030000002601000082840c000600' +
          '00003e01000000000000600000000100' +
          '00006000000001000000080008000800' +
          '0000c0000000c0000000c0000000c000' +
          '0000c0000000c0006e0100006e01c000' +
          '6e0180016e0140026e0100036e01c003' +
          '010001000100333333333333b33f3333' +
          '33333333b33f00000000000000000000' +
          '00000000000000000000000000000000' +
          '00000000000000000000404a36410000' +
          '00006e60534100000000000000004e4e',
        'hex',
      ),
    );
    fsa.register('memory://', source);

    const tiff = await createTiff('memory://BX20_500_023098.tif');
    const bbox = await findBoundingBox(tiff);

    assert.deepEqual(bbox, [1460800, 5079120, 1461040, 5079480]);
  });

  const url = new URL('memory://BX20_500_023098.tif');
  const fakeSource: Source = { url: url, fetch: async () => new ArrayBuffer(1) };
  it('should not parse a tiff with no information ', async () => {
    // tiff with no location information and no TFW
    await assert.rejects(() => findBoundingBox({ source: fakeSource, images: [] } as unknown as Tiff));
  });

  it('should parse a tiff with TFW', async () => {
    // Write a sidecar tfw
    await fsa.write(fsa.toUrl('memory://BX20_500_023098.tfw'), `0.075\n0\n0\n-0.075\n1460800.0375\n5079479.9625`);
    // tiff with no location information and no TFW
    const bbox = await findBoundingBox({
      source: fakeSource,
      images: [{ size: { width: 3200, height: 4800 } }] as unknown as TiffImage,
    } as unknown as Tiff);
    assert.deepEqual(bbox, [1460800, 5079120, 1461040, 5079480]);
    await fsa.delete(fsa.toUrl('memory://BX20_500_023098.tfw'));
  });

  it('should parse standard tiff', async () => {
    const bbox = await findBoundingBox({
      source: fakeSource,
      images: [
        {
          isGeoLocated: true,
          size: { width: 3200, height: 4800 },
          resolution: [0.075, -0.075],
          origin: [1460800, 5079480],
          valueGeo(): number {
            return 1; // PixelIsArea
          },
        } as unknown as TiffImage,
      ],
    } as unknown as Tiff);
    assert.deepEqual(bbox, [1460800, 5079120, 1461040, 5079480]);
  });
  it('should parse with pixel offset', async () => {
    const bbox = await findBoundingBox({
      source: fakeSource,
      images: [
        {
          isGeoLocated: true,
          size: { width: 3200, height: 4800 },
          resolution: [0.075, -0.075, 0],
          origin: [1460800.0375, 5079479.9625, 0], // PixelIsPoint offsets points by 1/2 a pixel
          valueGeo(): number {
            return PixelIsPoint;
          },
        } as unknown as TiffImage,
      ],
    } as unknown as Tiff);
    assert.deepEqual(bbox, [1460800, 5079120, 1461040, 5079480]);
  });
});
