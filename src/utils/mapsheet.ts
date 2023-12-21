/** Parse topographic mapsheet names in the format `${mapSheet}_${gridSize}_${y}${x}` */
const MapSheetRegex = /([A-Z]{2}\d{2})_(\d+)_(\d+)/;

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

const charA = 'A'.charCodeAt(0);
const charS = 'S'.charCodeAt(0);

/** Three sheets codes are not used and should be skipped */
const Skipped = new Set(['BI', 'BO', 'CI']);

/**
 * Topographic 1:50k map sheet calculator
 *
 * Useful for working with LINZ's Topo 1:50k mapsheet names and any of the tile indexes
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
  /** Height of Topo 1:50k mapsheets (meters) */
  height: 36_000,
  /** Width of Topo 1:50k mapsheets (meters) */
  width: 24_000,
  /** Base scale Topo 1:50k mapsheets (meters) */
  scale: 50_000,
  /** Map Sheets start at AS and end at CK */
  code: { start: 'AS', end: 'CK' },
  /** The top left point for where map sheets start from in NZTM2000 (EPSG:2193) */
  origin: { x: 988000, y: 6234000 },
  gridSizeMax: 50000,
  roundCorrection: 0.01,
  /** Allowed grid sizes, these should exist in the LINZ Data service (meters) */
  gridSizes: [50_000, 10_000, 5_000, 2_000, 1_000, 500],

  /**
   * Get the expected origin and mapsheet information from a file name
   *
   * @example
   * ```typescript
   * MapSheet.extract("BP27_1000_4817.tiff") // { mapSheet: "BP27", gridSize: 1000, x: 17, y:48 }
   * ```
   */
  extract(fileName: string): MapTileIndex | null {
    const match = fileName.match(MapSheetRegex);
    if (match == null) return null;
    if (match[1] == null) return null;

    const out: MapTileIndex = {
      mapSheet: match[1],
      gridSize: Number(match[2]),
      x: -1,
      y: -1,
      name: match[0],
      origin: { x: 0, y: 0 },
      width: 0,
      height: 0,
      bbox: [0, 0, 0, 0],
    };
    // 1:500 has X/Y is 3 digits not 2
    if (out.gridSize === 500) {
      out.y = Number(match[3]?.slice(0, 3));
      out.x = Number(match[3]?.slice(3));
    } else {
      out.y = Number(match[3]?.slice(0, 2));
      out.x = Number(match[3]?.slice(2));
    }
    if (isNaN(out.gridSize) || isNaN(out.x) || isNaN(out.y)) return null;

    const origin = MapSheet.offset(out.mapSheet);
    if (origin == null) return null;

    const tileOffset = MapSheet.tileSize(out.gridSize, out.x, out.y);
    out.origin.x = origin.x + tileOffset.x;
    out.origin.y = origin.y - tileOffset.y;
    out.width = tileOffset.width;
    out.height = tileOffset.height;
    // As in NZTM negative Y goes north, the minY is actually the bottom right point
    out.bbox = [out.origin.x, out.origin.y - tileOffset.height, out.origin.x + tileOffset.width, out.origin.y];
    return out;
  },
  /**
   * Calculate the expected X & Y origin point for a map sheet
   *
   * @example
   * ```typescript
   * MapSheet.offset("AZ") // { x: 988000, y: 5982000 }
   * ```
   */
  offset(sheetCode: string): { x: number; y: number } | null {
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
  },

  /** Generate the size of tile inside a map sheet at a specific grid size */
  tileSize(gridSize: number, x: number, y: number): Bounds {
    const scale = gridSize / MapSheet.scale;
    const offsetX = MapSheet.width * scale;
    const offsetY = MapSheet.height * scale;
    return { x: (x - 1) * offsetX, y: (y - 1) * offsetY, width: offsetX, height: offsetY };
  },

  /**
   * Iterate mapsheet codes
   * @example
   * ```typescript
   * [...MapSheet.iterate()] // [ 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', ... ]
   * ````
   */
  *iterate(): Generator<string> {
    for (let first = 0; first < 3; first++) {
      for (let second = 0; second < 26; second++) {
        if (first === 0 && second < charS - charA) continue;
        const mapSheet = `${String.fromCharCode(charA + first)}${String.fromCharCode(charA + second)}`;
        if (Skipped.has(mapSheet)) continue;

        yield mapSheet;
        if (mapSheet === MapSheet.code.end) return;
      }
    }
  },
};

// Ranges of valid sheet columns for each sheet row. Keys are the row names, and values are ranges
// between which there are valid rows. For example `"AS": [(21, 22), (24, 24)]` means the valid
// sheets in row AS are AS21, AS22, and AS24.
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
};
