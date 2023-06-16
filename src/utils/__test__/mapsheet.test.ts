import o from 'ospec';
import { MapSheet, MapTileIndex } from '../mapsheet.js';
import { MapSheetData } from './mapsheet.data.js';

o.spec('MapSheets', () => {
  o('should extract mapsheet', () => {
    o(MapSheet.extract('2022_CG10_500_080037.tiff')).deepEquals({
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

  o('should iterate mapsheets', () => {
    const sheets = [...MapSheet.iterate()];
    o(sheets).deepEquals(ExpectedCodes);
  });

  o('should calculate offsets', () => {
    o(MapSheet.offset('AS00')).deepEquals({ x: 988000, y: 6234000 });
    o(MapSheet.offset('AS21')).deepEquals({ x: 1492000, y: 6234000 });
    o(MapSheet.offset('BG33')).deepEquals({ x: 1780000, y: 5730000 });
    o(MapSheet.offset('BW14')).deepEquals({ x: 1324000, y: 5226000 });
  });

  for (const ms of MapSheetData) {
    o('should calculate for ' + ms.code, () => {
      o(MapSheet.offset(ms.code)).deepEquals(ms.origin);
    });
  }

  const ExpectedCodes = [...new Set(MapSheetData.map((f) => f.code.slice(0, 2)))];
  const TestBounds = [
    { name: 'CG10_500_079035', bbox: [1236160, 4837560, 1236400, 4837920] },
    { name: 'CG10_500_079036', bbox: [1236400, 4837560, 1236640, 4837920] },
  ] as const;

  for (const test of TestBounds) {
    o('should get expected size with file ' + test.name, () => {
      const extract = MapSheet.extract(test.name) as MapTileIndex;
      o(extract.origin.x).equals(test.bbox[0]);
      o(extract.origin.y).equals(test.bbox[3]);
      o(extract.width).equals(test.bbox[2] - test.bbox[0]);
      o(extract.height).equals(test.bbox[3] - test.bbox[1]);
    });

    o('should get expected bounds with file ' + test.name, () => {
      const extract = MapSheet.extract(test.name) as MapTileIndex;
      o(String(extract.bbox)).equals(String(test.bbox));
    });
  }
});

o.run();
