import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import { FeatureCollection } from 'geojson';

import { MapSheetData } from '../../../utils/__test__/mapsheet.data.js';
import { GridSize, MapSheet } from '../../../utils/mapsheet.js';
import {
  commandTileIndexValidate,
  extractTiffLocations,
  getTileName,
  GridSizeFromString,
  groupByTileName,
  TiffLoader,
} from '../tileindex.validate.js';
import { FakeCogTiff } from './tileindex.validate.data.js';

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

  it('should not validate invalid mapsheets', () => {
    assert.throws(() => convertTileName('BC39_10000_0101', 50000), Error);
  });

  for (const sheet of MapSheetData) {
    it('should get the top left 1:50k, 1:10k, 1:5k and 1:1k 1:500 for ' + sheet.code, () => {
      // getTileName
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 50000), sheet.code);
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 10000), sheet.code + '_10000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 5000), sheet.code + '_5000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 1000), sheet.code + '_1000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 500), sheet.code + '_500_001001');
    });

    it('should get the bottom right 1:50k, 1:10k, 1:5k, 1:1k for ' + sheet.code, () => {
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
    });
  }
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
    assert.equal(location[0]?.tileName, 'AS21_1000_0101');
    assert.equal(location[1]?.tileName, 'AY29_1000_0101');
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
    assert.deepEqual(duplicates.get('AS21_1000_0101')?.map((c) => c.source), [
      's3://path/AS21_1000_0101.tiff',
      's3://path/AS21_1000_0101.tiff',
    ]);
    assert.deepEqual(duplicates.get('AY29_1000_0101')?.map((c) => c.source), [
      's3://path/AY29_1000_0101.tiff',
      's3://path/AY29_1000_0101.tiff',
    ]);
  });

  it('should find tiles from 3857', async () => {
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].epsg = 3857;
    TiffAy29.images[0].origin[0] = 19128043.69337794;
    TiffAy29.images[0].origin[1] = -4032710.6009459053;
    const location = await extractTiffLocations([TiffAy29], 1000);
    assert.equal(location[0]?.tileName, 'AS21_1000_0101');
  });
});

describe('validate', () => {
  const memory = new FsMemory();

  before(() => {
    fsa.register('/tmp', memory);
  });
  beforeEach(() => memory.files.clear());

  it('should fail if duplicate tiles are detected', async (t) => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    const stub = t.mock.method(TiffLoader, 'load', () =>
      Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
    );

    try {
      await commandTileIndexValidate.handler({
        location: ['s3://test'],
        retile: false,
        validate: true,
        scale: 1000,
        forceOutput: true,
      } as any);
      assert.fail('Should throw exception');
    } catch (e) {
      assert.equal(String(e), 'Error: Duplicate files found, see output.geojson');
    }

    assert.equal(stub.mock.callCount(), 1);
    assert.deepEqual(stub.mock.calls[0]?.arguments[0], ['s3://test']);

    const outputFileList: FeatureCollection = await fsa.readJson('/tmp/tile-index-validate/output.geojson');
    assert.equal(outputFileList.features.length, 1);
    const firstFeature = outputFileList.features[0];
    assert.equal(firstFeature?.properties?.['tileName'], 'AS21_1000_0101');
    assert.deepEqual(firstFeature?.properties?.['source'], [
      's3://path/AS21_1000_0101.tiff',
      's3://path/AS21_1000_0101.tiff',
    ]);
  });

  it('should not fail if duplicate tiles are detected but --retile is used', async (t) => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    t.mock.method(TiffLoader, 'load', () =>
      Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
    );

    await commandTileIndexValidate.handler({
      location: ['s3://test'],
      retile: true,
      scale: 1000,
      forceOutput: true,
    } as any);
    const outputFileList = await fsa.readJson('/tmp/tile-index-validate/file-list.json');
    assert.deepEqual(outputFileList, [
      { output: 'AS21_1000_0101', input: ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'] },
    ]);
  });

  for (const offset of [0.05, -0.05]) {
    it(`should fail if input tiff origin X is offset by ${offset}m`, async (t) => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].origin[0] = fakeTiff.images[0].origin[0] + offset;
      t.mock.method(TiffLoader, 'load', () => Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
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
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
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
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
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
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
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
