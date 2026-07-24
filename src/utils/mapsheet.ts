import { EpsgCode } from '@basemaps/geo';

/** Parse topographic map sheet names in the format `${mapSheet}_${gridSize}_${y}${x}` */
const MapSheetRegex = /(?<sheetCode>[A-Z]{2}\d{2})(_(?<gridSize>\d+)_(?<tileId>\d+))?/;

export interface MapTileIndex {
  /**
   * Topo50 MapSheet code
   * @example
   * ```typescript
   * "BP27"
   * "CH10"
   * ```
   **/
  mapSheet: string;
  /**
   * Grid size, 1,000, 500
   * @see {MapSheet.gridSizes}
   */
  gridSize: number;
  /** Tile X offset */
  x: number;
  /** Tile Y offset */
  y: number;
  /**
   * Combined tile name in the format `${mapSheet}_${gridSize}_${y}${x}`
   *
   * Tile offsets are "0" padded to 2 characters unless
   * {gridSize} is less than 500 where 3 characters is used.
   *
   * @example
   * ```typescript
   * "BP27_1000_4817"
   * "CH10_500_001052"
   * ```
   */
  name: string;
  /** Top left point of the MapSheet Tile */
  origin: { x: number; y: number };
  /** Width of the Tile (meters) */
  width: number;
  /** Height of the tile (meters) */
  height: number;
  /** Bounding box of the tile [minX, minY, maxX, maxY] */
  bbox: [number, number, number, number];
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

/**
 * Common shape of a topographic map sheet grid, so that commands (eg `tileindex-validate`) can
 * work with more than one grid (eg mainland NZTM50 vs {@link ChathamMapSheet}) without caring
 * which one they have.
 */
export interface MapSheetLike {
  /** EPSG code of the coordinate reference system this map sheet grid is defined in */
  crs: number;
  /** Top left point of the grid the map sheets are laid out on */
  origin: Point;
  /** Width of a 1:50k map sheet (meters) */
  width: number;
  /** Height of a 1:50k map sheet (meters) */
  height: number;
  /** Base (1:50k) scale of the grid (meters) */
  gridSizeMax: number;
  /** Allowed grid sizes for sub-tiling a map sheet (meters) */
  gridSizes: readonly number[];
  /** Calculate the map sheet code covering a X & Y point */
  sheetCode(x: number, y: number): string;
  /** Is this sheet code part of the known range for this grid */
  isKnown(sheet: string): boolean;
  /** Get the expected origin and map sheet information from a file name */
  getMapTileIndex(fileName: string): MapTileIndex | null;
}

const charA = 'A'.charCodeAt(0);
const charS = 'S'.charCodeAt(0);

export const MapSheetTileGridSize = 50_000;
export const GridSizes = [MapSheetTileGridSize, 10_000, 5_000, 2_000, 1_000, 500] as const;
export type GridSize = (typeof GridSizes)[number];

/**
 * Shared tile calculation logic between {@link MapSheet} and {@link ChathamMapSheet}: both are
 * laid out with identical 24,000m x 36,000m 1:50k sheets and sub-tiling scheme, they only differ
 * in which CRS they're defined in and how a sheet code maps to its origin.
 *
 * @param getOffset Look up the top left point of a 1:50k map sheet from its sheet code
 */
function computeMapTileIndex(fileName: string, getOffset: (sheetCode: string) => Point): MapTileIndex | null {
  const match = fileName.match(MapSheetRegex);
  if (match == null) return null;

  const sheetCode = match?.groups?.['sheetCode'];
  if (sheetCode == null) return null;

  const gridSize = Number(match?.groups?.['gridSize'] ?? MapSheetTileGridSize);
  const out: MapTileIndex = {
    mapSheet: sheetCode,
    gridSize: gridSize,
    x: -1,
    y: -1,
    name: match[0],
    origin: { x: 0, y: 0 },
    width: 0,
    height: 0,
    bbox: [0, 0, 0, 0],
  };

  const mapSheetOffset = getOffset(sheetCode);
  if (out.gridSize === MapSheetTileGridSize) {
    out.y = mapSheetOffset.y;
    out.x = mapSheetOffset.x;
    out.origin = mapSheetOffset;
    out.width = MapSheet.width;
    out.height = MapSheet.height;
    // As in NZTM negative Y goes north, the minY is actually the bottom right point
    out.bbox = [out.origin.x, out.origin.y - out.height, out.origin.x + out.width, out.origin.y];
    return out;
  }

  // 1:500 has X/Y is 3 digits not 2
  if (out.gridSize === 500) {
    out.y = Number(match?.groups?.['tileId']?.slice(0, 3));
    out.x = Number(match?.groups?.['tileId']?.slice(3));
  } else {
    out.y = Number(match?.groups?.['tileId']?.slice(0, 2));
    out.x = Number(match?.groups?.['tileId']?.slice(2));
  }
  if (isNaN(out.gridSize) || isNaN(out.x) || isNaN(out.y)) return null;

  const origin = getOffset(out.mapSheet);

  const tileOffset = MapSheet.tileSize(out.gridSize, out.x, out.y);
  out.origin.x = origin.x + tileOffset.x;
  out.origin.y = origin.y - tileOffset.y;
  out.width = tileOffset.width;
  out.height = tileOffset.height;
  // As in NZTM negative Y goes north, the minY is actually the bottom right point
  out.bbox = [out.origin.x, out.origin.y - tileOffset.height, out.origin.x + tileOffset.width, out.origin.y];
  return out;
}

/**
 * Topographic 1:50k map sheet calculator
 *
 * Useful for working with LINZ's Topo 1:50k map sheet names and any of the tile indexes
 *
 * LINZ Topo50:
 * - https://www.linz.govt.nz/products-services/maps/new-zealand-topographic-maps/topo50-map-chooser/topo50-sheet-index
 *
 * Tile Indexes:
 * - https://data.linz.govt.nz/layer/104687-nz-150k-tile-index/ 1:50,000
 * - https://data.linz.govt.nz/layer/104690-nz-110k-tile-index/ 1:10,000
 * - https://data.linz.govt.nz/layer/104691-nz-15k-tile-index/  1:5,000
 * - https://data.linz.govt.nz/layer/106966-nz-12k-tile-index/  1:2,000
 * - https://data.linz.govt.nz/layer/104692-nz-11k-tile-index/  1:1,000
 * - https://data.linz.govt.nz/layer/106965-nz-1500-tile-index/ 1:500
 **/
export const MapSheet = {
  /** EPSG code of the CRS this map sheet grid is defined in (NZGD2000 / NZTM2000) */
  crs: EpsgCode.Nztm2000,
  /** Height of Topo 1:50k map sheets (meters) */
  height: 36_000,
  /** Width of Topo 1:50k map sheets (meters) */
  width: 24_000,
  /** Base scale Topo 1:50k map sheets (meters) */
  scale: MapSheetTileGridSize,
  /** Map Sheets start at AS and end at CK */
  code: { start: 'AS', end: 'CK' },
  /** The top left point for where map sheets start from in NZTM2000 (EPSG:2193) */
  origin: { x: 988000, y: 6234000 },
  gridSizeMax: MapSheetTileGridSize,
  roundCorrection: 0.01,
  /** Allowed grid sizes, these should exist in the LINZ Data service (meters) */
  gridSizes: GridSizes,

  /**
   * Get the expected origin and map sheet information from a file name
   *
   * @example
   * ```typescript
   * MapSheet.getMapTileIndex("BP27_1000_4817.tiff") // { mapSheet: "BP27", gridSize: 1000, x: 17, y:48 }
   * ```
   */
  getMapTileIndex(fileName: string): MapTileIndex | null {
    return computeMapTileIndex(fileName, (sheetCode) => MapSheet.offset(sheetCode));
  },
  /**
   * Calculate the expected X & Y origin point for a map sheet
   *
   * @example
   * ```typescript
   * MapSheet.offset("AZ") // { x: 988000, y: 5982000 }
   * ```
   */
  offset(sheetCode: string): { x: number; y: number } {
    const ms = sheetCode.slice(0, 2);
    const x = Number(sheetCode.slice(2));

    const baseYOffset = charS - charA;
    const firstLetterOffset = (ms.charCodeAt(0) - charA) * 26;
    const secondLetterOffset = ms.charCodeAt(1) - charA;

    let y = firstLetterOffset + secondLetterOffset - baseYOffset;

    // There are three missing map sheet codes
    if (ms > 'CI') y -= 3;
    else if (ms > 'BO') y -= 2;
    else if (ms > 'BI') y--;

    return { x: MapSheet.width * x + MapSheet.origin.x, y: MapSheet.origin.y - MapSheet.height * y };
  },

  /**
   * Calculate the Mapsheet sheet code from a NZTM2000 (EPSG:2193) X & Y point
   *
   * @warning this does **not** ensure the sheet code is inside the expected range see {@link MapSheet.isKnown}
   *
   * @example
   * ```typescript
   * MapSheet.offset(988000, 5982000) // "AZ00"
   * ```
   * @param x X offset of the sheet
   * @param y Y offset of the sheet
   * @returns Sheet code
   */
  sheetCode(x: number, y: number): string {
    const offsetX = Math.round(Math.floor((x - MapSheet.origin.x) / MapSheet.width));
    const offsetY = Math.round(Math.floor((MapSheet.origin.y - y) / MapSheet.height));

    let charYOffset = offsetY;

    // BI does not exist
    if (charYOffset >= 16) charYOffset++;
    // BO does not exist
    if (charYOffset >= 22) charYOffset++;
    // CI does not exist
    if (charYOffset >= 42) charYOffset++;

    // Sheet codes start at "AS"
    const baseYOffset = charS - charA;
    charYOffset = charYOffset + baseYOffset;

    const firstLetterOffset = String.fromCharCode(Math.floor(charYOffset / 26) + charA);
    const secondLetterOffset = String.fromCharCode((charYOffset % 26) + charA);

    return `${firstLetterOffset}${secondLetterOffset}${String(offsetX).padStart(2, '0')}`;
  },

  /** Generate the size of tile inside a map sheet at a specific grid size */
  tileSize(gridSize: number, x: number, y: number): Bounds {
    const scale = gridSize / MapSheet.scale;
    const offsetX = MapSheet.width * scale;
    const offsetY = MapSheet.height * scale;
    return { x: (x - 1) * offsetX, y: (y - 1) * offsetY, width: offsetX, height: offsetY };
  },

  /**
   * Is this mapsheet part of the known mapsheet ranges
   *
   * {@link SheetRanges}
   */
  isKnown(sheet: string): boolean {
    const key = sheet.slice(0, 2);
    const index = Number(sheet.slice(2, 4));
    if (Number.isNaN(index)) return false;
    const ranges = SheetRanges[key as keyof typeof SheetRanges];
    if (ranges == null) return false;
    for (const [low, high] of ranges) {
      if (low <= index && index <= high) return true;
    }
    return false;
  },
};

/**
 * Ranges of valid sheet columns for each sheet row. Keys are the row names, and values are ranges
 * between which there are valid rows. For example `"AS": [(21, 22), (24, 24)]` means the valid
 * sheets in row AS are AS21, AS22, and AS24.
 */
export const SheetRanges = {
  AS: [
    [21, 22],
    [24, 24],
  ],
  AT: [[23, 26]],
  AU: [[24, 29]],
  AV: [[24, 30]],
  AW: [[25, 32]],
  AX: [[27, 33]],
  AY: [[28, 35]],
  AZ: [[28, 36]],
  BA: [[29, 37]],
  BB: [[30, 37]],
  BC: [
    [30, 38],
    [40, 41],
  ],
  BD: [[31, 46]],
  BE: [[31, 46]],
  BF: [[30, 45]],
  BG: [[29, 45]],
  BH: [[28, 44]],
  BJ: [[27, 43]],
  BK: [[28, 40]],
  BL: [[28, 40]],
  BM: [
    [23, 25],
    [32, 39],
  ],
  BN: [
    [22, 29],
    [32, 38],
  ],
  BP: [[22, 37]],
  BQ: [[21, 36]],
  BR: [
    [19, 30],
    [32, 34],
  ],
  BS: [[19, 29]],
  BT: [[18, 28]],
  BU: [[16, 27]],
  BV: [[15, 27]],
  BW: [[14, 26]],
  BX: [[12, 26]],
  BY: [[10, 26]],
  BZ: [[8, 23]],
  CA: [[7, 22]],
  CB: [[6, 20]],
  CC: [[5, 20]],
  CD: [[4, 19]],
  CE: [[4, 18]],
  CF: [[4, 17]],
  CG: [[4, 16]],
  CH: [[5, 14]],
  CJ: [[7, 11]],
  CK: [[7, 9]],
} as const;

/** A single Chatham Islands Topo50 map sheet */
export interface ChathamSheetDefinition {
  /** Sheet code, eg "CI06" */
  code: string;
  /** Row of the sheet in the Chatham Islands map sheet grid, 0 is the northernmost row */
  row: number;
  /** Column of the sheet in the Chatham Islands map sheet grid, 0 is the westernmost column */
  col: number;
  /** Top left point of the sheet, in EPSG:3793 */
  origin: Point;
}

/**
 * The six Chatham Islands Topo50 mapsheets (EPSG:3793, NZGD2000 / Chatham Islands TM 2000),
 * laid out on the same 24,000m x 36,000m 1:50k grid as the mainland {@link MapSheet},
 * with a different origin and layout of sheet codes. The following sheet codes are used:
 *
 * +------+------+------+
 * | CI01 | CI02 | CI03 |
 * |      |      |      |
 * +------+------+------+
 *        | CI04 | CI05 |
 *        |      |      |
 *        +------+------+
 *               | CI06 |
 *               |      |
 *               +------+
 *
 * "CI" is one of the mainland NZ grid's three missing row codes (see {@link SheetRanges})
 * as it's reserved for the Chatham Islands map sheets.
 *
 * Reference:
 * https://data.linz.govt.nz/layer/50089-nz-chatham-island-linz-map-sheets-topo-150k/
 */
export const ChathamMapSheetData: ChathamSheetDefinition[] = [
  { code: 'CI01', row: 0, col: 0, origin: { x: 3_458_000, y: 5_176_000 } }, // Point Somes
  { code: 'CI02', row: 0, col: 1, origin: { x: 3_482_000, y: 5_176_000 } }, // Cape Young
  { code: 'CI03', row: 0, col: 2, origin: { x: 3_506_000, y: 5_176_000 } }, // Kaingaroa
  { code: 'CI04', row: 1, col: 1, origin: { x: 3_482_000, y: 5_140_000 } }, // Waitangi
  { code: 'CI05', row: 1, col: 2, origin: { x: 3_506_000, y: 5_140_000 } }, // Owenga
  { code: 'CI06', row: 2, col: 2, origin: { x: 3_506_000, y: 5_104_000 } }, // Pitt Island (Rangiauria)
];

const ChathamSheetByCode = new Map(ChathamMapSheetData.map((s) => [s.code, s]));
const ChathamSheetByRowCol = new Map(ChathamMapSheetData.map((s) => [`${s.row},${s.col}`, s]));

export const ChathamMapSheet = {
  /** EPSG code of the CRS this map sheet grid is defined in (NZGD2000 / Chatham Islands TM 2000) */
  crs: EpsgCode.Citm2000,
  /** Height of Topo 1:50k map sheets (meters), identical to the mainland grid */
  height: MapSheet.height,
  /** Width of Topo 1:50k map sheets (meters), identical to the mainland grid */
  width: MapSheet.width,
  /** Top left point of the Chatham Islands map sheet grid, in EPSG:3793 */
  origin: { x: 3_458_000, y: 5_176_000 },
  gridSizeMax: MapSheetTileGridSize,
  gridSizes: GridSizes,

  /** Get the expected origin and map sheet information from a file name */
  getMapTileIndex(fileName: string): MapTileIndex | null {
    return computeMapTileIndex(fileName, (sheetCode) => ChathamMapSheet.offset(sheetCode));
  },

  /**
   * Get the expected origin for a Chatham Islands sheet code
   *
   * @example
   * ```typescript
   * ChathamMapSheet.offset("CI06") // { x: 3506000, y: 5104000 }
   * ```
   */
  offset(sheetCode: string): Point {
    const sheet = ChathamSheetByCode.get(sheetCode.slice(0, 4));
    if (sheet != null) return sheet.origin;
    // Outside the six known sheets, there is nothing sensible to compute - fall back to the grid
    // origin so callers get a usable (if geographically meaningless) point rather than crashing;
    // `isKnown()` will flag the sheet code so this is visible in logs.
    return ChathamMapSheet.origin;
  },

  /**
   * Calculate the Chatham Islands sheet code from an EPSG:3793 X & Y point
   *
   * @warning this does **not** ensure the sheet code is inside the expected range see {@link ChathamMapSheet.isKnown}
   */
  sheetCode(x: number, y: number): string {
    const col = Math.floor((x - ChathamMapSheet.origin.x) / ChathamMapSheet.width);
    const row = Math.floor((ChathamMapSheet.origin.y - y) / ChathamMapSheet.height);
    const sheet = ChathamSheetByRowCol.get(`${row},${col}`);
    if (sheet != null) return sheet.code;
    // Not one of the six known sheets; synthesize a code so callers get a parseable string, `isKnown()` will flag it.
    return `CI${Math.abs(row) % 10}${Math.abs(col) % 10}`;
  },

  /** Is this one of the six known Chatham Islands map sheets */
  isKnown(sheet: string): boolean {
    return ChathamSheetByCode.has(sheet.slice(0, 4));
  },
};

/** Registry of the map sheet grids supported by `tileindex-validate`, keyed by their EPSG code */
export const MapSheetRegistry: Record<number, MapSheetLike> = {
  [MapSheet.crs]: MapSheet,
  [ChathamMapSheet.crs]: ChathamMapSheet,
};

/**
 * Get the map sheet grid to use for a given target EPSG code
 *
 * @throws if the EPSG code is not one of the supported map sheet grids
 */
export function getMapSheet(epsg: number): MapSheetLike {
  const mapSheet = MapSheetRegistry[epsg];
  if (mapSheet == null) {
    throw new Error(
      `Unsupported target EPSG:${epsg}; supported target EPSG codes: ${Object.keys(MapSheetRegistry).join(', ')}`,
    );
  }
  return mapSheet;
}
