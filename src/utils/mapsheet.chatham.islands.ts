// import { Bounds, MapSheetRegex, MapTileIndex } from './mapsheet.js';

// export const CiSheetRegex = /(?<sheetCode>CI\d{2})(_(?<gridSize>\d+)_(?<tileId>\d+))?/;

// export interface MapSheetCi {
//   name: string;
//   x: number;
//   y: number;
// }

// export const MapSheetChathamIslands = {
//   /** Height of Topo 1:50k map sheets (meters) */
//   height: 36_000,
//   /** Width of Topo 1:50k map sheets (meters) */
//   width: 24_000,

//   gridSizeMax: 50_000,
//   scale: 50_000,

//   /**
//    * Map sheets are laid out in a pattern resembling:
//    *
//    * ```
//    * [CI01] [CI02] [CI03]
//    *        [CI04] [CI05]
//    *               [CI06]
//    * ```
//    */
//   origins: [
//     // First row
//     { name: 'CI01', x: 3458000, y: 5176000 },
//     { name: 'CI02', x: 3482000, y: 5176000 },
//     { name: 'CI03', x: 3506000, y: 5176000 },

//     // Second row
//     { name: 'CI04', x: 3482000, y: 5140000 },
//     { name: 'CI05', x: 3506000, y: 5140000 },

//     // Third row
//     { name: 'CI06', x: 3506000, y: 5104000 },
//   ],

//   getMapTileIndex(str: string): MapTileIndex | null {
//     const match = str.match(CiSheetRegex);
//     if (match == null) return null;

//     const sheetCode = match?.groups?.['sheetCode'];
//     if (sheetCode == null) return null;

//     const gridSize = Number(match?.groups?.['gridSize'] ?? this.gridSizeMax);
//     const out: MapTileIndex = {
//       mapSheet: sheetCode,
//       gridSize: gridSize,
//       x: -1,
//       y: -1,
//       name: match[0],
//       origin: { x: 0, y: 0 },
//       width: 0,
//       height: 0,
//       bbox: [0, 0, 0, 0],
//     };
//     const mapSheetOffset = this.offset(sheetCode);

//     if (out.gridSize === this.gridSizeMax) {
//       out.y = mapSheetOffset.y;
//       out.x = mapSheetOffset.x;
//       out.origin = mapSheetOffset;
//       out.width = this.width;
//       out.height = this.height;
//       // As in CITM negative Y goes north, the minY is actually the bottom right point
//       out.bbox = [out.origin.x, out.origin.y - out.height, out.origin.x + out.width, out.origin.y];
//       return out;
//     }

//     // 1:500 has X/Y is 3 digits not 2
//     if (out.gridSize === 500) {
//       out.y = Number(match?.groups?.['tileId']?.slice(0, 3));
//       out.x = Number(match?.groups?.['tileId']?.slice(3));
//     } else {
//       out.y = Number(match?.groups?.['tileId']?.slice(0, 2));
//       out.x = Number(match?.groups?.['tileId']?.slice(2));
//     }
//     if (isNaN(out.gridSize) || isNaN(out.x) || isNaN(out.y)) return null;

//     const tileOffset = this.tileSize(out.gridSize, out.x, out.y);
//     out.origin.x = mapSheetOffset.x + tileOffset.x;
//     out.origin.y = mapSheetOffset.y - tileOffset.y;
//     out.width = tileOffset.width;
//     out.height = tileOffset.height;
//     // As in NZTM negative Y goes north, the minY is actually the bottom right point
//     out.bbox = [out.origin.x, out.origin.y - tileOffset.height, out.origin.x + tileOffset.width, out.origin.y];

//     return out;
//   },
//   tileSize(gridSize: number, x: number, y: number): Bounds {
//     const scale = gridSize / this.gridSizeMax;
//     const offsetX = this.width * scale;
//     const offsetY = this.height * scale;
//     return { x: (x - 1) * offsetX, y: (y - 1) * offsetY, width: offsetX, height: offsetY };
//   },
//   offset(sheet: string): { x: number; y: number } {
//     for (const o of this.origins) if (sheet == o.name) return { x: o.x, y: o.y };
//     throw new Error('Sheet not found');
//   },

//   getMapSheet(x: number, y: number): MapSheetCi {
//     for (const o of MapSheetChathamIslands.origins) {
//       if (o.x < x && x < o.x + this.width) {
//         if (o.y > y && y > o.y - this.height) {
//           return o;
//         }
//       }
//     }

//     throw new Error(`Unable to find mapsheet for point: ${x},${y}`);
//   },

//   getTileName(x: number, y: number, gridSize: number): string {
//     const ms = this.getMapSheet(x, y);

//     if (gridSize === MapSheetChathamIslands.gridSizeMax) return ms.name;

//     const tilesPerMapSheet = Math.floor(MapSheetChathamIslands.gridSizeMax / gridSize);
//     const tileWidth = Math.floor(MapSheetChathamIslands.width / tilesPerMapSheet);
//     const tileHeight = Math.floor(MapSheetChathamIslands.height / tilesPerMapSheet);

//     const nbDigits = gridSize === 500 ? 3 : 2;

//     const tileX = Math.round(Math.floor((x - ms.x) / tileWidth + 1));
//     const tileY = Math.round(Math.floor((ms.y - y) / tileHeight + 1));
//     const tileId = `${`${tileY}`.padStart(nbDigits, '0')}${`${tileX}`.padStart(nbDigits, '0')}`;
//     return `${ms.name}_${gridSize}_${tileId}`;
//   },
// };

// /**
//  * 3518000.19287
// 5085999.80449
//  */

// // const pt = [3522800.00752, 5085999.99359, 3525200.00752, 5089599.99359] as const;

// console.log(MapSheetChathamIslands.getTileName(3518000.19287, 5085999.80449, 5000));
// console.log(MapSheetChathamIslands.getMapTileIndex('SN8066_CI06_5000_0606.tfw'));
