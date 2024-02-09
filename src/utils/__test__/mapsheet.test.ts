import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MapSheet, MapTileIndex } from '../mapsheet.js';
import { MapSheetData } from './mapsheet.data.js';

describe('MapSheets', () => {
  it('should extract MapTileIndex from 1:500 tile filename', () => {
    assert.deepEqual(MapSheet.getMapTileIndex('2022_CG10_500_080037.tiff'), {
      mapSheet: 'CG10',
      gridSize: 500,
      x: 37,
      y: 80,
      name: 'CG10_500_080037',
      origin: { x: 1236640, y: 4837560 },
      width: 240,
      height: 360,
      bbox: [1236640, 4837200, 1236880, 4837560],
    });
  });
  it('should extract MapTileIndex from 1:50k tile filename', () => {
    assert.deepEqual(MapSheet.getMapTileIndex('AS21.tiff'), {
      mapSheet: 'AS21',
      gridSize: 50_000,
      x: 1_492_000, // MapSheet.offset('AS21').x
      y: 6_234_000, // MapSheet.offset('AS21').y
      name: 'AS21',
      origin: { x: 1_492_000, y: 6_234_000 }, // MapSheet.offset('AS21')
      width: 24_000, // MapSheet.width
      height: 36_000, // MapSheet.height
      bbox: [
        1_492_000, // MapSheet.offset('AS21').x
        6_198_000, // MapSheet.offset('AS21').y - MapSheet.height
        1_516_000, // MapSheet.offset('AS21').x + MapSheet.width
        6_234_000, // MapSheet.offset('AS21').y
      ],
    });
  });

  it('should calculate offsets', () => {
    assert.deepEqual(MapSheet.offset('AS00'), { x: 988000, y: 6234000 });
    assert.deepEqual(MapSheet.offset('AS21'), { x: 1492000, y: 6234000 });
    assert.deepEqual(MapSheet.offset('BG33'), { x: 1780000, y: 5730000 });
    assert.deepEqual(MapSheet.offset('BW14'), { x: 1324000, y: 5226000 });
  });

  for (const ms of MapSheetData) {
    it('should calculate for ' + ms.code, () => {
      assert.deepEqual(MapSheet.offset(ms.code), ms.origin);
    });
  }

  const TestBounds = [
    { name: 'CG10_500_079035', bbox: [1236160, 4837560, 1236400, 4837920] },
    { name: 'CG10_500_079036', bbox: [1236400, 4837560, 1236640, 4837920] },
  ] as const;

  for (const test of TestBounds) {
    it('should get expected size with file ' + test.name, () => {
      const mapTileIndex = MapSheet.getMapTileIndex(test.name) as MapTileIndex;
      assert.equal(mapTileIndex.origin.x, test.bbox[0]);
      assert.equal(mapTileIndex.origin.y, test.bbox[3]);
      assert.equal(mapTileIndex.width, test.bbox[2] - test.bbox[0]);
      assert.equal(mapTileIndex.height, test.bbox[3] - test.bbox[1]);
    });

    it('should get expected bounds with file ' + test.name, () => {
      const mapTileIndex = MapSheet.getMapTileIndex(test.name) as MapTileIndex;
      assert.equal(String(mapTileIndex.bbox), String(test.bbox));
    });
  }
});
