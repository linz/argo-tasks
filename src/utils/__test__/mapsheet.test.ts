import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { MapTileIndex } from '../mapsheet.ts';
import { ChathamMapSheet, ChathamMapSheetData, getMapSheet, MapSheet, SheetRanges } from '../mapsheet.ts';
import { MapSheetData } from './mapsheet.data.ts';

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

  it('should calculate for all sheets', () => {
    for (const ms of MapSheetData) {
      assert.deepEqual(MapSheet.offset(ms.code), ms.origin);
      assert.equal(MapSheet.isKnown(ms.code), true);
    }
  });

  it('should round trip all sheets', () => {
    for (const ms of MapSheetData) {
      assert.equal(MapSheet.sheetCode(ms.origin.x, ms.origin.y), ms.code);
    }
  });

  it('should not know invalid mapsheets', () => {
    assert.equal(MapSheet.isKnown('BC39'), false);
    assert.equal(MapSheet.isKnown('AAAA'), false);
    assert.equal(MapSheet.isKnown('A'), false);
    assert.equal(MapSheet.isKnown('BC99'), false);
    assert.equal(MapSheet.isKnown('bw14'), false);
    assert.equal(MapSheet.isKnown('AA14'), false);
  });

  it('should validate map sheet range', () => {
    const validSheet = new Set();
    for (const [key, ranges] of Object.entries(SheetRanges)) {
      for (const [low, high] of ranges) {
        for (let i = low; i <= high; i++) {
          const code = String(i).padStart(2, '0');
          validSheet.add(`${key}${code}`);
        }
      }
    }

    for (const sheet of MapSheetData) {
      assert.equal(validSheet.has(sheet.code), true, 'Sheetcode missing: ' + sheet.code);
      validSheet.delete(sheet.code);
    }
    assert.equal(validSheet.size, 0);
  });

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

describe('ChathamMapSheet', () => {
  // Values sourced from nz-chatham-island-linz-map-sheets-topo-150k.shp (EPSG:3793)
  it('should extract MapTileIndex from 1:50k tile filename', () => {
    assert.deepEqual(ChathamMapSheet.getMapTileIndex('CI06.tiff'), {
      mapSheet: 'CI06',
      gridSize: 50_000,
      x: 3_506_000,
      y: 5_104_000,
      name: 'CI06',
      origin: { x: 3_506_000, y: 5_104_000 },
      width: 24_000,
      height: 36_000,
      bbox: [3_506_000, 5_068_000, 3_530_000, 5_104_000],
    });
  });

  it('should extract MapTileIndex from a sub-tiled filename', () => {
    // Regression test for a real production incident: this file genuinely exists at
    // s3://nz-imagery/chatham-islands/chatham-islands_sn8066_1982-1983_0.375m/rgb/3793/CI06_5000_0507.tiff
    // but tileindex-validate mis-tiled it against the mainland NZTM50 grid instead.
    assert.deepEqual(ChathamMapSheet.getMapTileIndex('CI06_5000_0507'), {
      mapSheet: 'CI06',
      gridSize: 5000,
      x: 7,
      y: 5,
      name: 'CI06_5000_0507',
      origin: { x: 3_520_400, y: 5_089_600 },
      width: 2400,
      height: 3600,
      bbox: [3_520_400, 5_086_000, 3_522_800, 5_089_600],
    });
  });

  it('should calculate offsets for all six known sheets', () => {
    for (const ms of ChathamMapSheetData) {
      assert.deepEqual(ChathamMapSheet.offset(ms.code), ms.origin);
      assert.equal(ChathamMapSheet.isKnown(ms.code), true);
    }
  });

  it('should round trip all six known sheets', () => {
    for (const ms of ChathamMapSheetData) {
      assert.equal(ChathamMapSheet.sheetCode(ms.origin.x, ms.origin.y), ms.code);
    }
  });

  it('should not know invalid or out-of-range sheets', () => {
    assert.equal(ChathamMapSheet.isKnown('CI99'), false);
    assert.equal(ChathamMapSheet.isKnown('CI00'), false); // grid cell exists but has no real sheet
    assert.equal(ChathamMapSheet.isKnown('AS21'), false); // a real mainland sheet code
  });

  it('should not be confused with the mainland grid at the same raw x/y', () => {
    // The mainland MapSheet formula still "works" (produces *a* answer) for Chatham Islands
    // coordinates reprojected into NZTM2000 - it must never be mistaken for a Chatham sheet code.
    const mainlandSheetCode = MapSheet.sheetCode(3_506_000, 5_104_000);
    assert.notEqual(mainlandSheetCode.slice(0, 2), 'CI');
  });
});

describe('getMapSheet', () => {
  it('should resolve the mainland and Chatham Islands grids by EPSG code', () => {
    assert.equal(getMapSheet(2193), MapSheet);
    assert.equal(getMapSheet(3793), ChathamMapSheet);
  });

  it('should throw for an unsupported target EPSG', () => {
    assert.throws(() => getMapSheet(4326), /Unsupported target EPSG:4326/);
  });
});
