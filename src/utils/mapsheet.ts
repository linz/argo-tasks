const MapSheetRegex = /([A-Z]{2}\d{2})_(\d+)_(\d+)/;

export interface MapTileIndex {
  mapSheet: string;
  gridSize: number;
  x: number;
  y: number;
  name: string;
  expected: Bounds;
}

export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export type Bounds = Point & Size;

function extractTileName(fileName: string): MapTileIndex | null {
  const match = fileName.match(MapSheetRegex);
  if (match == null) return null;

  const out: MapTileIndex = {
    mapSheet: match[1],
    gridSize: Number(match[2]),
    x: -1,
    y: -1,
    name: match[0],
    expected: { x: 0, y: 0, width: 0, height: 0 },
  };
  // 1:500 has X/Y is 3 digits not 2
  if (out.gridSize === 500) {
    out.y = Number(match[3].slice(0, 3));
    out.x = Number(match[3].slice(3));
  } else {
    out.y = Number(match[3].slice(0, 2));
    out.x = Number(match[3].slice(2));
  }
  if (isNaN(out.gridSize) || isNaN(out.x) || isNaN(out.y)) return null;

  const origin = MapSheet.offset(out.mapSheet);
  if (origin == null) return null;

  const tileOffset = MapSheet.tileOffset(out.gridSize, out.x, out.y);
  out.expected.x = origin.x + tileOffset.x;
  out.expected.y = origin.y - tileOffset.y;
  out.expected.width = tileOffset.width;
  out.expected.height = tileOffset.height;
  return out;
}

const charA = 'A'.charCodeAt(0);
const charS = 'S'.charCodeAt(0);
function* iterateMapSheets(): Generator<string> {
  for (let first = 0; first < 3; first++) {
    for (let second = 0; second < 26; second++) {
      if (first === 0 && second < charS - charA) continue;
      const mapSheet = `${String.fromCharCode(charA + first)}${String.fromCharCode(charA + second)}`;
      if (Skipped.has(mapSheet)) continue;

      yield mapSheet;
      if (mapSheet === MapSheet.code.end) return;
    }
  }
}

function mapSheetOffset(sheetCode: string): { x: number; y: number } | null {
  const ms = sheetCode.slice(0, 2);
  const x = Number(sheetCode.slice(2));

  const baseYOffset = charS - charA;
  const firstLetterOffset = (ms.charCodeAt(0) - charA) * 26;
  const secondLetterOffset = ms.charCodeAt(1) - charA;

  let y = firstLetterOffset + secondLetterOffset - baseYOffset;

  // There are three missing map sheets
  if (ms > 'CI') y -= 3;
  else if (ms > 'BO') y -= 2;
  else if (ms > 'BI') y--;

  return { x: MapSheet.width * x + MapSheet.origin.x, y: MapSheet.origin.y - MapSheet.height * y };
}

export function tileOffset(gridSize: number, x: number, y: number): Bounds {
  const scale = gridSize / MapSheet.scale;
  const offsetX = MapSheet.width * scale;
  const offsetY = MapSheet.height * scale;
  return { x: (x - 1) * offsetX, y: (y - 1) * offsetY, width: offsetX, height: offsetY };
}

const Skipped = new Set(['BI', 'BO', 'CI']);

export const MapSheet = {
  height: 36_000,
  width: 24_000,
  scale: 50_000,
  code: { start: 'AS', end: 'CK' },
  origin: { x: 988000, y: 6234000 },
  extract: extractTileName,
  offset: mapSheetOffset,
  tileOffset,
  iterate: iterateMapSheets,
};
