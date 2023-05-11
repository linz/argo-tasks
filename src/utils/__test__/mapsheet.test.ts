import o from 'ospec';
import { MapSheet } from '../mapsheet.js';
import { MapSheetData } from './mapsheet.data.js';

o.spec('MapSheets', () => {
  o('should extract mapsheet', () => {
    o(MapSheet.extract('2022_CG10_500_080037.tiff')).deepEquals({
      mapSheet: 'CG10',
      gridSize: 500,
      x: 37,
      y: 80,
      name: 'CG10_500_080037',
      bounds: { x: 1236640, y: 4837560, width: 240, height: 360 },
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
    { name: 'CG10_500_079035', bounds: [1236160, 4837560, 1236400, 4837920] },
    { name: 'CG10_500_079036', bounds: [1236400, 4837560, 1236640, 4837920] },
  ];

  for (const test of TestBounds) {
    o('should get expected bounds with file ' + test.name, () => {
      const expected = MapSheet.extract(test.name)?.bounds;
      o(expected?.x).equals(test.bounds[0]);
      o(expected?.y).equals(test.bounds[3]);
      o(expected?.width).equals(test.bounds[2] - test.bounds[0]);
      o(expected?.height).equals(test.bounds[3] - test.bounds[1]);
    });
  }
});
