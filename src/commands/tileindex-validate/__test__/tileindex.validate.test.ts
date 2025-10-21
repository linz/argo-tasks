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
  determineGridSizeFromDimensions,
  determineGridSizeFromGSDPreset,
  extractTiffLocations,
  getTileName,
  GridSizeFromString,
  groupByTileName,
  reprojectIfNeeded,
  TiffLoader,
  validate8BitsTiff,
  validatePreset,
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
    retile: 'auto' as const,
    location: [[fsa.toUrl('s3://test')]],
  };

  it('should set the includeDerived flag in file-list.json based on its input flag', async (t) => {
    t.mock.method(TiffLoader, 'load', () => Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101')]));
    for (const includeDerived of [true, false]) {
      await commandTileIndexValidate.handler({
        ...baseArguments,
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
        validate: true,
      })
      .catch((e: Error) => e);
    assert.equal(String(ret), 'Error: Tiff loading failed: RangeError: Offset is outside the bounds of the DataView');
  });

  it('should not fail if duplicate tiles are detected but --retile true is used', async (t) => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    t.mock.method(TiffLoader, 'load', () =>
      Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
    );

    await commandTileIndexValidate.handler({
      ...baseArguments,
      validate: false,
      retile: true,
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
          validate: true,
        });
        assert.fail('Should throw exception');
      } catch (e) {
        assert.equal(String(e), 'Error: Tile alignment validation failed');
      }
    });
    it('should validate single tile when validate=auto', async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      // Offset to make it misaligned
      fakeTiff.images[0].origin[0] = fakeTiff.images[0].origin[0] + 0.05;
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));

      try {
        await commandTileIndexValidate.handler({
          ...baseArguments,
          validate: 'auto',
          retile: false,
        });
        assert.fail('Should throw exception due to misalignment with auto validation');
      } catch (e) {
        assert.equal(String(e), 'Error: Tile alignment validation failed');
      }
    });
    it('should pass validation for aligned tile with validate=auto', async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));

      await commandTileIndexValidate.handler({
        ...baseArguments,
        validate: 'auto',
        retile: false,
      });

      const outputFileList = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
      assert.deepEqual(outputFileList, [
        {
          output: 'AS21_1000_0101',
          input: ['s3://path/AS21_1000_0101.tiff'],
          includeDerived: false,
        },
      ]);
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
      new Error('Invalid grid size "-1"; valid values: "50000", "10000", "5000", "2000", "1000", "500", or "auto"'),
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
    scale: 1000 as GridSize,
    forceOutput: true,
    retile: 'auto' as const,
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

describe('determineGridSize', () => {
  // Aerial Imagery (preset: 'webp')
  it('returns 1000 for aerial imagery < 0.1m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.05, 'webp'), 1000);
  });
  it('returns 5000 for aerial imagery >= 0.1m and < 0.25m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.1, 'webp'), 5000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.249, 'webp'), 5000);
  });
  it('returns 10000 for aerial imagery >= 0.25m and < 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.25, 'webp'), 10000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.999, 'webp'), 10000);
  });
  it('returns 50000 for aerial imagery >= 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(1.0, 'webp'), 50000);
    assert.strictEqual(determineGridSizeFromGSDPreset(2.0, 'webp'), 50000);
  });

  // DEM/DSM/Hillshade (preset: 'dem_lerc')
  it('returns 1000 for elevation < 0.2m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.1, 'dem_lerc'), 1000);
  });
  it('returns 10000 for elevation >= 0.2m and <= 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.2, 'dem_lerc'), 10000);
    assert.strictEqual(determineGridSizeFromGSDPreset(1.0, 'dem_lerc'), 10000);
  });
  it('returns 50000 for elevation > 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(1.01, 'dem_lerc'), 50000);
    assert.strictEqual(determineGridSizeFromGSDPreset(2.0, 'dem_lerc'), 50000);
  });

  it('throws error for unknown preset', () => {
    assert.throws(() => determineGridSizeFromGSDPreset(0.5, 'unknown'), /Unknown preset/);
  });
});

describe('determineGridSizeFromDimensions', () => {
  it('should return 50000 for 50k map sheet dimensions', () => {
    const width = 24000; // 50k map sheet width in meters
    const height = 36000; // 50k map sheet height in meters
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 50000);
  });

  it('should return 10000 for 10k tile dimensions', () => {
    const width = 4800; // 10k tile width in meters (24000/5)
    const height = 7200; // 10k tile height in meters (36000/5)
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 10000);
  });

  it('should return 5000 for 5k tile dimensions', () => {
    const width = 2400; // 5k tile width in meters (24000/10)
    const height = 3600; // 5k tile height in meters (36000/10)
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 5000);
  });

  it('should return 2000 for 2k tile dimensions', () => {
    const width = 960; // 2k tile width in meters (24000/25)
    const height = 1440; // 2k tile height in meters (36000/25)
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 2000);
  });

  it('should return 1000 for 1k tile dimensions', () => {
    const width = 480; // 1k tile width in meters (24000/50)
    const height = 720; // 1k tile height in meters (36000/50)
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 1000);
  });

  it('should return 500 for 500m tile dimensions', () => {
    const width = 240; // 500m tile width in meters (24000/100)
    const height = 360; // 500m tile height in meters (36000/100)
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 500);
  });

  it('should allow small rounding errors (within 1 meter)', () => {
    const width = 480.5; // 1k tile width + 0.5m
    const height = 719.5; // 1k tile height - 0.5m
    assert.strictEqual(determineGridSizeFromDimensions(width, height), 1000);
  });

  it('should return null for dimensions that do not match any grid size', () => {
    const width = 123.45;
    const height = 678.9;
    assert.strictEqual(determineGridSizeFromDimensions(width, height), null);
  });

  it('should return null when rounding error exceeds 1 meter', () => {
    const width = 201.5; // 1k tile width + 1.5m (exceeds tolerance)
    const height = 300;
    assert.strictEqual(determineGridSizeFromDimensions(width, height), null);
  });
});

describe('retile flag behavior', () => {
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
    retile: 'auto' as const,
    location: [[fsa.toUrl('s3://test')]],
  };

  it('should fail with duplicate same-scale tiles when --retile auto (default)', async (t) => {
    const fakeTiff1 = FakeCogTiff.fromTileName('AS21_1000_0101');
    const fakeTiff2 = FakeCogTiff.fromTileName('AS21_1000_0101');
    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2]));

    try {
      await commandTileIndexValidate.handler({
        ...baseArguments,
        retile: 'auto',
        validate: true,
      });
      assert.fail('Should throw exception for same-scale duplicates');
    } catch (e) {
      assert.equal(String(e), 'Error: Duplicate files found, see output.geojson');
    }
  });
});

describe('automatic retiling based on scale comparison', () => {
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
    validate: false,
    preset: 'none',
    sourceEpsg: undefined,
    includeDerived: false,
    scale: 5000 as GridSize, // Output scale is 5000
    forceOutput: true,
    retile: 'auto' as const,
    location: [[fsa.toUrl('s3://test')]],
  };

  it('should allow retiling when all input tiffs have different scale than output', async (t) => {
    // Create tiffs with 1000m scale dimensions (different from output scale 5000)
    const fakeTiff1 = FakeCogTiff.fromTileName('AS21_1000_0101', { size: { width: 240, height: 360 } });
    const fakeTiff2 = FakeCogTiff.fromTileName('AS21_1000_0101', { size: { width: 240, height: 360 } });

    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2]));

    await commandTileIndexValidate.handler(baseArguments);

    const outputFileList = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
    assert.deepEqual(outputFileList, [
      {
        output: 'AS21_5000_0101', // Output scale is 5000
        input: ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'],
        includeDerived: false,
      },
    ]);
  });
  it('should fail when all input tiffs have same scale as output and retile is auto', async (t) => {
    const fakeTiff1 = FakeCogTiff.fromTileName('AS21_5000_0101'); // Input scale matches output scale
    const fakeTiff2 = FakeCogTiff.fromTileName('AS21_5000_0101'); // Duplicate with same scale

    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2]));

    try {
      await commandTileIndexValidate.handler({
        ...baseArguments,
        validate: true,
      });
      assert.fail('Should throw exception for same-scale duplicates');
    } catch (e) {
      assert.equal(String(e), 'Error: Duplicate files found, see output.geojson');
    }
  });

  it('should allow retiling when input tiffs have mixed scales', async (t) => {
    // Create tiffs with different scales - one 1000m and one 5000m
    const fakeTiff1000 = FakeCogTiff.fromTileName('AS21_1000_0101', { size: { width: 240, height: 360 } });
    const fakeTiff5000 = FakeCogTiff.fromTileName('AS21_5000_0101', { size: { width: 1200, height: 1800 } });

    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff1000, fakeTiff5000]));

    await commandTileIndexValidate.handler(baseArguments);

    const outputFileList = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
    assert.deepEqual(outputFileList, [
      {
        output: 'AS21_5000_0101',
        input: ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_5000_0101.tiff'],
        includeDerived: false,
      },
    ]);
  });
});

describe('TiffLocation scale attribute', () => {
  it('should populate scale attribute from detected grid size', async () => {
    const fakeTiff1000 = FakeCogTiff.fromTileName('AS21_1000_0101', { size: { width: 480, height: 720 } });
    const fakeTiff5000 = FakeCogTiff.fromTileName('AS21_5000_0101', { size: { width: 2400, height: 3600 } });

    const locations = await extractTiffLocations([fakeTiff1000, fakeTiff5000], 10000);

    assert.strictEqual(locations[0]?.scale, 1000);
    assert.strictEqual(locations[1]?.scale, 5000);
  });

  it('should fall back to output grid size when scale cannot be detected', async () => {
    const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101', { size: { width: 123, height: 456 } });

    const locations = await extractTiffLocations([fakeTiff], 2000);

    assert.strictEqual(locations[0]?.scale, 2000); // Falls back to output grid size
  });

  it('should handle auto scale detection correctly', async (t) => {
    const memory = new FsMemory();
    fsa.register('file:///tmp', memory);
    fsa.register('memory://', memory);

    const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101', { gsd: 0.15 });

    t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));

    await commandTileIndexValidate.handler({
      config: undefined,
      verbose: false,
      include: undefined,
      validate: false,
      preset: 'webp',
      sourceEpsg: undefined,
      includeDerived: false,
      scale: 'auto',
      forceOutput: true,
      retile: 'auto' as const,
      location: [[fsa.toUrl('s3://test')]],
    });

    const outputFileList: [FileListEntryClass] = await fsa.readJson(
      fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
    );
    assert.strictEqual(outputFileList?.[0]?.output, 'AS21_5000_0101'); // Should auto-select 5000 scale
  });
});
