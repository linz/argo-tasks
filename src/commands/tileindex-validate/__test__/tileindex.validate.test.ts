import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';

import { Projection } from '@basemaps/geo';
import { fsa, FsMemory } from '@chunkd/fs';
import type { BBox } from '@linzjs/geojson';
import type { FeatureCollection } from 'geojson';
import { pathToFileURL } from 'url';

import { logger } from '../../../log.ts';
import { MapSheetData } from '../../../utils/__test__/mapsheet.data.ts';
import type { FileListEntryClass } from '../../../utils/filelist.ts';
import type { GridSize } from '../../../utils/mapsheet.ts';
import { MapSheet } from '../../../utils/mapsheet.ts';
import { createTiff, Url } from '../../common.ts';
import {
  commandTileIndexValidate,
  extractTiffLocations,
  getSize,
  getTileName,
  GridSizeFromString,
  groupByTileName,
  isTiff,
  reprojectIfNeeded,
  TiffLoader,
  validate8BitsTiff,
  validatePreset,
  validateTiffAlignment,
  type TiffLocation,
} from '../tileindex.validate.ts';
import { FakeCogTiff } from './tileindex.validate.data.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

function convertTileName(fileName: string, gridSize: GridSize): string | null {
  const mapTileIndex = MapSheet.getMapTileIndex(fileName);
  if (mapTileIndex == null) return null;
  return getTileName(mapTileIndex.bbox[0], mapTileIndex.bbox[3], gridSize);
}

describe('getTileName', () => {
  it('should get correct parent tile 1:1k', () => {
    assert.equal(convertTileName('CH11_1000_0101', 1000), 'CH11_1000_0101');
    assert.equal(convertTileName('CH11_1000_0105', 1000), 'CH11_1000_0105');
    assert.equal(convertTileName('CH11_1000_0501', 1000), 'CH11_1000_0501');
    assert.equal(convertTileName('CH11_1000_0505', 1000), 'CH11_1000_0505');
  });
  it('should get correct parent tile 1:5k', () => {
    assert.equal(convertTileName('CH11_1000_0101', 5000), 'CH11_5000_0101');
    assert.equal(convertTileName('CH11_1000_0105', 5000), 'CH11_5000_0101');
    assert.equal(convertTileName('CH11_1000_0501', 5000), 'CH11_5000_0101');
    assert.equal(convertTileName('CH11_1000_0505', 5000), 'CH11_5000_0101');
  });

  it('should get correct parent tile 1:10k', () => {
    assert.equal(convertTileName('CH11_1000_0101', 10000), 'CH11_10000_0101');
    assert.equal(convertTileName('CH11_1000_0110', 10000), 'CH11_10000_0101');
    assert.equal(convertTileName('CH11_1000_1010', 10000), 'CH11_10000_0101');
    assert.equal(convertTileName('CH11_1000_1001', 10000), 'CH11_10000_0101');
  });
  it('should get correct parent tile 1:50k', () => {
    assert.equal(convertTileName('AT24_50000_0101', 50000), 'AT24');
    assert.equal(convertTileName('AT25_50000_0101', 50000), 'AT25');
    assert.equal(convertTileName('CK08_50000_0101', 50000), 'CK08');
  });

  it('should get the top left 1:50k, 1:10k, 1:5k, 1:1k, and 1:500 for all sheets', () => {
    for (const sheet of MapSheetData) {
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 50000), sheet.code);
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 10000), sheet.code + '_10000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 5000), sheet.code + '_5000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 1000), sheet.code + '_1000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 500), sheet.code + '_500_001001');
    }
  });

  it('should get the bottom right 1:50k, 1:10k, 1:5k, 1:1k for all sheets', () => {
    for (const sheet of MapSheetData) {
      // for each scale calculate the bottom right tile then find the mid point of it
      // then look up the tile name from the midpoint and ensure it is the same
      for (const scale of [10_000, 5_000, 1_000, 500] as const) {
        const tileCount = 50_000 / scale;
        const tileName = `${tileCount - 1}`.padStart(scale === 500 ? 3 : 2, '0');
        const sheetName = `${sheet.code}_${scale}_${tileName}${tileName}`;
        const ret = MapSheet.getMapTileIndex(sheetName)!;
        const midPointX = ret.origin.x + ret.width / 2;
        const midPointY = ret.origin.y - ret.height / 2;
        assert.equal(getTileName(midPointX, midPointY, scale), sheetName);
      }
    }
  });
});
describe('tiffLocation', () => {
  it('get location from tiff', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    const location = await extractTiffLocations([TiffAs21, TiffAy29], 1000);
    assert.deepEqual(location[0]?.tileNames, ['AS21_1000_0101']);
    assert.deepEqual(location[1]?.tileNames, ['AY29_1000_0101']);
  });

  it('should find duplicates', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    const location = await extractTiffLocations([TiffAs21, TiffAy29, TiffAs21, TiffAy29], 1000);
    const duplicates = groupByTileName(location);
    assert.deepEqual(
      duplicates.get('AS21_1000_0101')?.map((c) => c.source.href),
      ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'],
    );
    assert.deepEqual(
      duplicates.get('AY29_1000_0101')?.map((c) => c.source.href),
      ['s3://path/AY29_1000_0101.tiff', 's3://path/AY29_1000_0101.tiff'],
    );
  });

  it('should find tiles from 3857', async () => {
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].epsg = 3857;
    TiffAy29.images[0].origin[0] = 19128043.69337794;
    TiffAy29.images[0].origin[1] = -4032710.6009459053;
    const location = await extractTiffLocations([TiffAy29], 1000);
    assert.deepEqual(location[0]?.tileNames, ['AS21_1000_0101']);
  });

  it('should fail if one location is not extracted', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    TiffAy29.images[0].epsg = 0; // make the projection failing
    await assert.rejects(extractTiffLocations([TiffAs21, TiffAy29], 1000));
  });
});

describe('validate', () => {
  const memory = new FsMemory();

  before(() => {
    fsa.register('file:///tmp', memory);
    fsa.register('memory://', memory);
  });
  beforeEach(() => memory.files.clear());

  const baseArguments = {
    config: undefined,
    verbose: false,
    include: undefined,
    validate: true,
    preset: 'none',
    sourceEpsg: undefined,
    includeDerived: false,
    scale: 1000 as GridSize,
    forceOutput: true,
    retile: false,
    location: [[fsa.toUrl('s3://test')]],
    concurrency: 1,
  };

  it('should set the includeDerived flag in file-list.json based on its input flag', async (t) => {
    t.mock.method(TiffLoader, 'load', () => Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101')]));
    for (const includeDerived of [true, false]) {
      await commandTileIndexValidate.handler({
        ...baseArguments,
        retile: true,
        includeDerived: includeDerived,
      });
      const outputFileList: [FileListEntryClass] = await fsa.readJson(
        fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
      );
      assert.strictEqual(outputFileList[0]?.includeDerived, includeDerived);
    }
  });

  it('should read from utf8 sources', async (t) => {
    const fakeTiff = FakeCogTiff.fromTileName('BQ32_1000_0101');
    // Destroy the "geo" part of geotiff so TFW loading is also checked fro URL handling
    Object.defineProperty(fakeTiff.images[0], 'isGeoLocated', { value: false });

    const sourceLocation = await Url.from(`memory://some-bucket/🦄 🌈/`);
    fakeTiff.source.url = new URL(`BQ32_1000_0101.tiff`, sourceLocation);

    const expectedBounds = MapSheet.getMapTileIndex('BQ32_1000_0101');
    assert.ok(expectedBounds);

    await fsa.write(
      new URL('BQ32_1000_0101.tfw', sourceLocation),
      `1\n0\n0\n-1\n${expectedBounds?.origin.x + 0.5}\n${expectedBounds?.origin.y - 0.5}`,
    );

    const stub = t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));
    await commandTileIndexValidate.handler({
      ...baseArguments,
      location: [[sourceLocation]],
      retile: false,
      validate: true,
    });

    const fileList: unknown[] = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));

    assert.deepEqual(fileList[0], {
      output: 'BQ32_1000_0101',
      input: [`memory://some-bucket/🦄 🌈/BQ32_1000_0101.tiff`],
      includeDerived: false,
    });
    assert.equal(stub.mock.callCount(), 1);
  });

  it('should fail if duplicate tiles are detected', async (t) => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    const stub = t.mock.method(TiffLoader, 'load', () =>
      Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
    );

    try {
      await commandTileIndexValidate.handler({
        ...baseArguments,
        location: [[fsa.toUrl('s3://test')]],
        retile: false,
        validate: true,
      });
      assert.fail('Should throw exception');
    } catch (e) {
      assert.equal(String(e), 'Error: Duplicate files found, see output.geojson');
    }

    assert.equal(stub.mock.callCount(), 1);
    assert.deepEqual(
      stub.mock.calls[0]?.arguments[0]?.map((url) => url.href),
      ['s3://test'],
    );

    const outputFileList: FeatureCollection = await fsa.readJson(
      fsa.toUrl('file:///tmp/tile-index-validate/output.geojson'),
    );
    assert.equal(outputFileList.features.length, 1);
    const firstFeature = outputFileList.features[0];
    assert.equal(firstFeature?.properties?.['tileName'], 'AS21_1000_0101');
    assert.deepEqual(firstFeature?.properties?.['source'], [
      's3://path/AS21_1000_0101.tiff',
      's3://path/AS21_1000_0101.tiff',
    ]);
  });

  it('should fail with 0 byte tiffs', async () => {
    await fsa.write(fsa.toUrl('file:///tmp/empty/foo.tiff'), Buffer.from(''));
    const ret = await commandTileIndexValidate
      .handler({
        ...baseArguments,
        location: [[fsa.toUrl('file:///tmp/empty/')]],
        retile: false,
        validate: true,
      })
      .catch((e: Error) => e);
    assert.equal(String(ret), 'Error: Tiff loading failed: RangeError: Offset is outside the bounds of the DataView');
  });

  it('should not fail if duplicate tiles are detected but --retile is used', async (t) => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    t.mock.method(TiffLoader, 'load', () =>
      Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
    );

    await commandTileIndexValidate.handler({
      ...baseArguments,
      retile: true,
      validate: false,
    });
    const outputFileList = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
    assert.deepEqual(outputFileList, [
      {
        output: 'AS21_1000_0101',
        input: ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'],
        includeDerived: false,
      },
    ]);
  });

  for (const offset of [0.05, -0.05]) {
    it(`should fail if input tiff origin X is offset by ${offset}m`, async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].origin[0] = fakeTiff.images[0].origin[0] + offset;
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          ...baseArguments,
          retile: true,
          validate: true,
        });
        assert.fail('Should throw exception');
      } catch (e) {
        assert.equal(String(e), 'Error: Tile alignment validation failed');
      }
    });
    it(`should fail if input tiff origin Y is offset by ${offset}m`, async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].origin[1] = fakeTiff.images[0].origin[1] + offset;
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          ...baseArguments,
          retile: true,
          validate: true,
        });
        assert.fail('Should throw exception');
      } catch (e) {
        assert.equal(String(e), 'Error: Tile alignment validation failed');
      }
    });
  }
  for (const offset of [0.1, -0.1]) {
    // Input AS21_1000_0101.tiff width/height by +1m, -1m =>
    // 720x480 => 721x480
    // 720x481 => 720x481
    // 721x481 => 721x481
    it(`should fail if input tiff width is off by ${offset}m`, async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].size.width = fakeTiff.images[0].size.width + offset;
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          ...baseArguments,
          retile: true,
          validate: true,
        });
        assert.fail('Should throw exception');
      } catch (e) {
        assert.equal(String(e), 'Error: Tile alignment validation failed');
      }
    });
    it(`should fail if input tiff height is off by ${offset}m`, async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].size.height = fakeTiff.images[0].size.height + offset;
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          ...baseArguments,
          retile: true,
          validate: true,
        });
        assert.fail('Should throw exception');
      } catch (e) {
        assert.equal(String(e), 'Error: Tile alignment validation failed');
      }
    });
  }
});

describe('GridSizeFromString', () => {
  it('should return grid size number', async () => {
    assert.equal(await GridSizeFromString.from('500'), 500);
  });
  it('should throw error when converting invalid grid size', async () => {
    await assert.rejects(
      GridSizeFromString.from('-1'),
      new Error('Invalid grid size "-1"; valid values: "50000", "10000", "5000", "2000", "1000", "500"'),
    );
  });
});

describe('is8BitsTiff', () => {
  it('should be a 8 bits TIFF', async () => {
    const testTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/8b.tiff'));
    await assert.doesNotReject(validate8BitsTiff(testTiff));
  });
  it('should not be a 8 bits TIFF', async () => {
    const testTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/16b.tiff'));
    await assert.rejects(validate8BitsTiff(testTiff), {
      name: 'Error',
      message: `${process.cwd()}/src/commands/tileindex-validate/__test__/data/16b.tiff is not a 8 bits TIFF`,
    });
  });
});

describe('validatePreset', () => {
  it('should validate multiple tiffs', async (t) => {
    const test16bTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/16b.tiff'));
    const test8bTiff = await createTiff(pathToFileURL('./src/commands/tileindex-validate/__test__/data/8b.tiff'));
    const fatalStub = t.mock.method(logger, 'fatal');
    await assert.rejects(validatePreset('webp', [test16bTiff, test16bTiff, test8bTiff]), {
      name: 'Error',
      message: `Tiff preset:"webp" validation failed`,
    });

    assert.equal(fatalStub.mock.callCount(), 2); // Should be called per tiff failure
    const opts = fatalStub.mock.calls[0]?.arguments[0] as unknown as Record<string, string>;
    assert.equal(opts['preset'], 'webp');
    assert.ok(opts['reason']?.includes('is not a 8 bits TIFF'));
  });
});

describe('TiffFromMisalignedTiff', () => {
  it('should properly identify all tiles under a tiff not aligned to our grid', async () => {
    const fakeTiffCover4 = FakeCogTiff.fromTileName('CJ09');
    fakeTiffCover4.images[0].origin[0] -= 10;
    fakeTiffCover4.images[0].origin[1] += 10;
    const fakeTiffCover9 = FakeCogTiff.fromTileName('BA33');
    fakeTiffCover9.images[0].origin[0] -= 10;
    fakeTiffCover9.images[0].origin[1] += 10;
    fakeTiffCover9.images[0].size.width += 100;
    fakeTiffCover9.images[0].size.height += 100;
    const fakeTiffCover3 = FakeCogTiff.fromTileName('BL32');
    fakeTiffCover3.images[0].origin[1] -= 10;
    fakeTiffCover3.images[0].size.height *= 2;
    const locations = await extractTiffLocations([fakeTiffCover4, fakeTiffCover9, fakeTiffCover3], 50000);

    assert.deepEqual(locations[0]?.tileNames, ['CH08', 'CH09', 'CJ08', 'CJ09']);
    assert.deepEqual(locations[1]?.tileNames, ['AZ32', 'AZ33', 'AZ34', 'BA32', 'BA33', 'BA34', 'BB32', 'BB33', 'BB34']);
    assert.deepEqual(locations[2]?.tileNames, ['BL32', 'BM32', 'BN32']);
  });
});

describe('reprojectIfNeeded', () => {
  it('should reproject the bounding box if projections are different', () => {
    const sourceProjection = Projection.get(4326); // WGS84
    const targetProjection = Projection.get(2193); // New Zealand Transverse Mercator 2000
    const bbox: BBox = [172, -41, 174, -38]; // Example bounding box in WGS84

    const reprojectedBbox = reprojectIfNeeded(bbox, sourceProjection, targetProjection) as BBox;
    assert.notDeepEqual(bbox.map(Math.round), reprojectedBbox.map(Math.round)); // expect output to be quite different
    assert.ok(reprojectedBbox);

    const roundtripBbox = reprojectIfNeeded(reprojectedBbox, targetProjection, sourceProjection);
    assert.deepEqual(bbox.map(Math.round), roundtripBbox?.map(Math.round)); // expect output to be very similar (floating point / rounding errors)
  });

  it('should return the same bounding box if projections are the same', () => {
    const sourceProjection = Projection.get(2193); // New Zealand Transverse Mercator 2000
    const targetProjection = Projection.get(2193); // New Zealand Transverse Mercator 2000
    const bbox: BBox = [1, 2, 3, 4]; // Example bounding box

    const reprojectedBbox = reprojectIfNeeded(bbox, sourceProjection, targetProjection);

    assert.deepEqual(reprojectedBbox, bbox);
  });
});

describe('GSD handling', () => {
  const memory = new FsMemory();

  before(() => {
    fsa.register('memory://', memory);
    fsa.register('file:///tmp', memory);
  });
  beforeEach(() => {
    memory.files.clear();
  });

  const baseArguments = {
    config: undefined,
    verbose: false,
    include: undefined,
    validate: false,
    preset: 'none',
    sourceEpsg: undefined,
    includeDerived: false,
    location: [[fsa.toUrl('s3://test')]],
    retile: false,
    scale: 1000 as GridSize,
    forceOutput: true,
    concurrency: 1,
  };
  const fakeTiff1 = FakeCogTiff.fromTileName('AS21_1000_0101');
  const fakeTiff2 = FakeCogTiff.fromTileName('AT21_1000_0101');
  const fakeTiff3 = FakeCogTiff.fromTileName('AU21_1000_0101');

  it('should fail if GSDs are inconsistent and --validate is used', async (t) => {
    fakeTiff1.images[0].resolution[0] = 1.23;
    fakeTiff2.images[0].resolution[0] = 3.21;
    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2]));

    const ret = await commandTileIndexValidate
      .handler({
        ...baseArguments,
        validate: true,
      })
      .catch((e: Error) => e);
    assert.ok(String(ret).startsWith('Error: Inconsistent GSDs found: '));
  });

  it('should output the first rounded GSD if GSDs are inconsistent and validate is not used', async (t) => {
    fakeTiff1.images[0].resolution[0] = 2.31051;
    fakeTiff2.images[0].resolution[0] = 1.123;
    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2]));

    await commandTileIndexValidate.handler({
      ...baseArguments,
      validate: false,
    });

    const outputGsd = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/gsd'));
    assert.deepEqual(outputGsd, '2.31');
  });

  it('should round the GSD to nearest 0.005', async (t) => {
    fakeTiff1.images[0].resolution[0] = 0.5;
    fakeTiff2.images[0].resolution[0] = 0.502499; // within tolerance
    fakeTiff3.images[0].resolution[0] = 0.4975; // within tolerance
    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2, fakeTiff3]));

    await commandTileIndexValidate.handler(baseArguments);

    const outputGsd = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/gsd'));
    assert.deepEqual(outputGsd, '0.5');
  });

  it(`should not output GSD with unnecessary 0s`, async (t) => {
    for (const val of [1.002, 0.998, 0.9999999999999999, 1.0000000000001]) {
      fakeTiff1.images[0].resolution[0] = Number(val);
      fakeTiff2.images[0].resolution[0] = fakeTiff1.images[0].resolution[0] + 0.000499; // within tolerance
      fakeTiff3.images[0].resolution[0] = fakeTiff1.images[0].resolution[0] - 0.0045; // within tolerance
      console.log(
        `Testing with ${val}`,
        fakeTiff1.images[0].resolution[0],
        fakeTiff2.images[0].resolution[0],
        fakeTiff3.images[0].resolution[0],
      );
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2, fakeTiff3]));

      await commandTileIndexValidate.handler(baseArguments);

      const outputGsd = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/gsd'));
      assert.deepEqual(outputGsd, '1');
    }
  });
});

describe('getSize', () => {
  it('should calculate width and height from bounding box', () => {
    const bbox: BBox = [1000, 2000, 1500, 2800];
    const size = getSize(bbox);
    assert.equal(size.width, 500);
    assert.equal(size.height, 800);
  });

  it('should handle negative coordinates', () => {
    const bbox: BBox = [-1500, -2800, -1000, -2000];
    const size = getSize(bbox);
    assert.equal(size.width, 500);
    assert.equal(size.height, 800);
  });

  it('should handle zero-sized bounding boxes', () => {
    const bbox: BBox = [100, 200, 100, 200];
    const size = getSize(bbox);
    assert.equal(size.width, 0);
    assert.equal(size.height, 0);
  });
});

describe('validateTiffAlignment', () => {
  it('should validate correctly aligned tiff', () => {
    const mapTileIndex = MapSheet.getMapTileIndex('AS21_1000_0101');
    assert.ok(mapTileIndex);

    const tiffLocation: TiffLocation = {
      source: new URL('s3://test/AS21_1000_0101.tiff'),
      bbox: mapTileIndex.bbox,
      epsg: 2193,
      tileNames: ['AS21_1000_0101'],
      bands: ['uint8', 'uint8', 'uint8'],
    };

    const isValid = validateTiffAlignment(tiffLocation);
    assert.equal(isValid, true);
  });

  it('should fail validation for misaligned tiff origin', () => {
    const mapTileIndex = MapSheet.getMapTileIndex('AS21_1000_0101');
    assert.ok(mapTileIndex);

    const tiffLocation: TiffLocation = {
      source: new URL('s3://test/AS21_1000_0101.tiff'),
      bbox: [
        mapTileIndex.bbox[0] + 0.02, // 2cm > 1.5cm tolerance
        mapTileIndex.bbox[1],
        mapTileIndex.bbox[2] + 0.02,
        mapTileIndex.bbox[3],
      ],
      epsg: 2193,
      tileNames: ['AS21_1000_0101'],
      bands: ['uint8', 'uint8', 'uint8'],
    };

    const isValid = validateTiffAlignment(tiffLocation);
    assert.equal(isValid, false);
  });

  it('should fail validation for tiff covering multiple tiles', () => {
    const mapTileIndex = MapSheet.getMapTileIndex('AS21_1000_0101');
    assert.ok(mapTileIndex);

    const tiffLocation: TiffLocation = {
      source: new URL('s3://test/multiTile.tiff'),
      bbox: mapTileIndex.bbox,
      epsg: 2193,
      tileNames: ['AS21_1000_0101', 'AS21_1000_0102'],
      bands: ['uint8', 'uint8', 'uint8'],
    };

    const isValid = validateTiffAlignment(tiffLocation);
    assert.equal(isValid, false);
  });

  it('should pass validation with allowed error tolerance', () => {
    const mapTileIndex = MapSheet.getMapTileIndex('AS21_1000_0101');
    assert.ok(mapTileIndex);

    const tiffLocation: TiffLocation = {
      source: new URL('s3://test/AS21_1000_0101.tiff'),
      bbox: [
        mapTileIndex.bbox[0] + 0.01, // 1cm < 1.5cm tolerance
        mapTileIndex.bbox[1] + 0.01,
        mapTileIndex.bbox[2] + 0.01,
        mapTileIndex.bbox[3] + 0.01,
      ],
      epsg: 2193,
      tileNames: ['AS21_1000_0101'],
      bands: ['uint8', 'uint8', 'uint8'],
    };

    const isValid = validateTiffAlignment(tiffLocation);
    assert.equal(isValid, true);
  });

  it('should fail validation for tiff with invalid tile name', () => {
    const tiffLocation: TiffLocation = {
      source: new URL('s3://test/invalid.tiff'),
      bbox: [1000, 2000, 1500, 2800],
      epsg: 2193,
      tileNames: ['INVALID_TILE_NAME'],
      bands: ['uint8', 'uint8', 'uint8'],
    };

    const isValid = validateTiffAlignment(tiffLocation);
    assert.equal(isValid, false);
  });
});

describe('isTiff', () => {
  it('should return true for .tiff extension', () => {
    const url = new URL('file:///path/to/image.tiff');
    assert.equal(isTiff(url), true);
  });

  it('should return true for .tif extension', () => {
    const url = new URL('file:///path/to/image.tif');
    assert.equal(isTiff(url), true);
  });

  it('should return true for .TIFF extension (case insensitive)', () => {
    const url = new URL('file:///path/to/image.TIFF');
    assert.equal(isTiff(url), true);
  });

  it('should return true for .TIF extension (case insensitive)', () => {
    const url = new URL('file:///path/to/image.TIF');
    assert.equal(isTiff(url), true);
  });

  it('should return false for not a TIFF type extension', () => {
    const url = new URL('file:///path/to/image.ext');
    assert.equal(isTiff(url), false);
  });

  it('should return false for files without extension', () => {
    const url = new URL('file:///path/to/file');
    assert.equal(isTiff(url), false);
  });

  it('should return false for .tiff substring in filename but different extension', () => {
    const url = new URL('file:///path/to/not-a-tiff.jpg');
    assert.equal(isTiff(url), false);
  });
});
