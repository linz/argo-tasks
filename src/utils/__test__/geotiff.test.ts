import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import { CogTiff } from '@cogeotiff/core';
import o from 'ospec';
import { PixelIsPoint, findBoundingBox, parseTfw } from '../geotiff.js';

o.spec('geotiff', () => {
  o.spec('parseTfw', () => {
    o('should parse tfw', () => {
      const output = parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375\n5079479.9625`);
      o(output).deepEquals({ scale: { x: 0.075, y: -0.075 }, origin: { x: 1460800, y: 5079480 } });
    });

    o('should fail on invalid numbers', () => {
      o(() => parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375`)).throws(Error); // Too Short
      o(() => parseTfw(`0.075a\n0\n0\n-0.075\n1460800.0375\n5079479.9625`)).throws(Error); // scaleX number is NaN
      o(() => parseTfw(`0.075\n0\n0\n-0.075a\n1460800.0375\n5079479.9625`)).throws(Error); // scaleY number is NaN
      o(() => parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375a\n5079479.9625`)).throws(Error); // originX number is NaN
      o(() => parseTfw(`0.075\n0\n0\n-0.075\n1460800.0375\n5079479.9625a`)).throws(Error); // originY number is NaN
    });

    o('should fail on invalid input', () => {
      o(() => parseTfw(null as unknown as string)).throws(Error);
    });
  });

  o('should parse tiff location', async () => {
    const source = new FsMemory();
    // Actual tiff file
    await source.write(
      'memory://BX20_500_023098.tif',
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

    const tiff = await new CogTiff(fsa.source('memory://BX20_500_023098.tif')).init(true);
    const bbox = await findBoundingBox(tiff);

    o(bbox).deepEquals([1460800, 5079120, 1461040, 5079480]);
  });

  o('should not parse a tiff with no information ', async () => {
    // tiff with no location information and no TFW
    const bbox = await findBoundingBox({
      source: { uri: 'memory://BX20_500_023098.tif' },
      getImage() {
        return {};
      },
    } as unknown as CogTiff);
    o(bbox).deepEquals(null);
  });

  o('should parse a tiff with TFW', async () => {
    // Write a sidecar tfw
    await fsa.write('memory://BX20_500_023098.tfw', `0.075\n0\n0\n-0.075\n1460800.0375\n5079479.9625`);
    // tiff with no location information and no TFW
    const bbox = await findBoundingBox({
      source: { uri: 'memory://BX20_500_023098.tif' },
      getImage() {
        return { size: { width: 3200, height: 4800 } };
      },
    } as unknown as CogTiff);
    o(bbox).deepEquals([1460800, 5079120, 1461040, 5079480]);
    await fsa.delete('memory://BX20_500_023098.tfw');
  });

  o('should parse standard tiff', async () => {
    const bbox = await findBoundingBox({
      source: { uri: 'memory://BX20_500_023098.tif' },
      getImage() {
        return {
          isGeoLocated: true,
          size: { width: 3200, height: 4800 },
          resolution: [0.075, -0.075],
          origin: [1460800, 5079480],
          valueGeo(): number {
            return 1; // PixelIsArea
          },
        };
      },
    } as unknown as CogTiff);
    o(bbox).deepEquals([1460800, 5079120, 1461040, 5079480]);
  });
  o('should parse with pixel offset', async () => {
    const bbox = await findBoundingBox({
      source: { uri: 'memory://BX20_500_023098.tif' },
      getImage() {
        return {
          isGeoLocated: true,
          size: { width: 3200, height: 4800 },
          resolution: [0.075, -0.075],
          origin: [1460800.0375, 5079479.9625], // PixelIsPoint offsets points by 1/2 a pixel
          valueGeo(): number {
            return PixelIsPoint;
          },
        };
      },
    } as unknown as CogTiff);
    o(bbox).deepEquals([1460800, 5079120, 1461040, 5079480]);
  });
});

o.run();
