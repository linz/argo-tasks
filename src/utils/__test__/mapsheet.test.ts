import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MapSheet, MapTileIndex } from '../mapsheet.js';
import { MapSheetData } from './mapsheet.data.js';

describe('MapSheets', () => {
  it('should extract mapsheet', () => {
    assert.deepEqual(MapSheet.extract('2022_CG10_500_080037.tiff'), {
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

  it('should generate 1:50k name', () => {
    assert.deepEqual(MapSheet.extract('CK08_50000_0101.tiff'), {
      mapSheet: 'CK08',
      gridSize: 50000,
      x: 1,
      y: 1,
      name: 'CK08',
      origin: { x: 1180000, y: 4758000 },
      width: 24000,
      height: 36000,
      bbox: [1180000, 4722000, 1204000, 4758000],
    });
  });

  it('should iterate mapsheets', () => {
    const sheets = [...MapSheet.iterate()];
    assert.deepEqual(sheets, ExpectedCodes);
  });

  it('should calculate offsets', () => {
    assert.deepEqual(MapSheet.offset('AS00'), { x: 988000, y: 6234000 });
    assert.deepEqual(MapSheet.offset('AS21'), { x: 1492000, y: 6234000 });
    assert.deepEqual(MapSheet.offset('BG33'), { x: 1780000, y: 5730000 });
    assert.deepEqual(MapSheet.offset('BW14'), { x: 1324000, y: 5226000 });
    assert.deepEqual(MapSheet.offset('CK08'), { x: 1180000, y: 4758000 });
  });

  for (const ms of MapSheetData) {
    it('should calculate for ' + ms.code, () => {
      assert.deepEqual(MapSheet.offset(ms.code), ms.origin);
    });
  }

  const ExpectedCodes = [...new Set(MapSheetData.map((f) => f.code.slice(0, 2)))];
  const TestBounds = [
    { name: 'CG10_500_079035', bbox: [1236160, 4837560, 1236400, 4837920] },
    { name: 'CG10_500_079036', bbox: [1236400, 4837560, 1236640, 4837920] },
  ] as const;

  for (const test of TestBounds) {
    it('should get expected size with file ' + test.name, () => {
      const extract = MapSheet.extract(test.name) as MapTileIndex;
      assert.equal(extract.origin.x, test.bbox[0]);
      assert.equal(extract.origin.y, test.bbox[3]);
      assert.equal(extract.width, test.bbox[2] - test.bbox[0]);
      assert.equal(extract.height, test.bbox[3] - test.bbox[1]);
    });

    it('should get expected bounds with file ' + test.name, () => {
      const extract = MapSheet.extract(test.name) as MapTileIndex;
      assert.equal(String(extract.bbox), String(test.bbox));
    });
  }
});
