import { Bounds } from '@basemaps/geo';
import { Projection } from '@basemaps/shared/build/proj/projection.js';
import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { boolean, command, flag, number, option, optional, restPositionals, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { getFiles } from '../../utils/chunk.js';
import { findBoundingBox } from '../../utils/geotiff.js';
import { MapSheet, SheetRanges } from '../../utils/mapsheet.js';
import { config, registerCli, verbose } from '../common.js';
// import { CommandListArgs } from '../list/list.js';

const SHEET_MIN_X = MapSheet.origin.x + 4 * MapSheet.width; // The minimum x coordinate of a valid sheet / tile
const SHEET_MAX_X = MapSheet.origin.x + 46 * MapSheet.width; // The maximum x coordinate of a valid sheet / tile
const SHEET_MIN_Y = MapSheet.origin.y - 41 * MapSheet.height; // The minimum y coordinate of a valid sheet / tile
const SHEET_MAX_Y = MapSheet.origin.y; // The maximum y coordinate of a valid sheet / tile

export function isTiff(x: string): boolean {
  const search = x.toLowerCase();
  return search.endsWith('.tiff') || search.endsWith('.tif');
}

export interface FileList {
  tileName: string;
  uris: string[];
}
/**
 * Validate list of tiffs match a LINZ Mapsheet tile index
 *
 * Asserts that there will be no duplicates
 *
 * If --allow-duplicates
 * The script will not error as it is assumed the 'duplicate' tiffs are to be retiled and merged.
 *
 * @output
 * /tmp/tile-index-validate/input.geojson
 * Geometry:
 *  bounding boxes of the input tiff files.
 *
 * Attributes:
 * - source (string): path to source tiff
 * - tileName (string): calculated target tileName
 * - isDuplicate (boolean): true if source tiffs with duplicate tilenames exist
 *
 * /tmp/tile-index-validate/output.geojson
 * Geometry:
 *  bounding boxes of the target tiff files
 *
 * Attributes:
 * - source (string[]): paths to source tiffs
 * - tileName (string): target tileName for target tile index
 *
 * /tmp/tile-index-validate/file-list.json
 * Filelist grouped by target tileNames
 *
 * Attributes:
 * - input (string[]): paths to source tiffs
 * - output (string): target tileName for target tile index
 *
 * @example
 * List a path and validate all tiff files inside of it
 *
 * ```bash
 * tileindex-validate --scale 5000 s3://linz-imagery/auckland/auckland_2010-2012_0.5m/rgb/2193/ --includes "[BE_232*].tiff"
 * ```
 *
 * Validate a collection of tiff files
 * ```bash
 * tileindex-validate --scale 5000 ./path/to/imagery/
 * ```
 */
export const commandTileIndexValidate = command({
  name: 'tileindex-validate',
  description: 'List input files and validate there are no duplicates.',
  args: {
    config,
    verbose,
    scale: option({ type: number, long: 'scale', description: 'Tile grid scale to align output tile to' }),
    sourceEpsg: option({ type: optional(number), long: 'source-epsg', description: 'Force epsg code for input tiffs' }),
    allowDuplicates: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'allow-duplicates',
      description: 'Allow Duplicates for Merging',
    }),
    forceOutput: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'force-output',
      description: 'force output additional files',
    }),
    location: restPositionals({ type: string, displayName: 'location', description: 'Where to list' }),
  },
  handler: async (args) => {
    registerCli(args);
    logger.info('TileIndex:Start');

    const readTiffStartTime = performance.now();
    const files = await getFiles(args.location);
    const tiffFiles = files.flat().filter(isTiff);
    if (tiffFiles.length === 0) throw new Error('No Files found');
    if (tiffFiles[0]) await fsa.head(tiffFiles[0]);
    const tiffs = await Promise.all(tiffFiles.map((f: string) => new CogTiff(fsa.source(f)).init(true)));

    const projections = new Set(tiffs.map((t) => t.getImage(0).epsg));
    logger.info(
      {
        tiffCount: tiffs.length,
        projections: [...projections],
        duration: performance.now() - readTiffStartTime,
      },
      'TileIndex: All Files Read',
    );

    if (projections.size > 1) {
      logger.warn({ projections: [...projections] }, 'TileIndex:InconsistentProjections');
    }

    const findDuplicatesStartTime = performance.now(); // TODO change name of duplicates
    const locations = await extractTiffLocations(tiffs, args.scale, args.sourceEpsg);
    const outputs = findDuplicates(locations); // TODO change name of function doesn't seem appropriate anymore
    console.log(outputs);

    logger.info(
      { duration: performance.now() - findDuplicatesStartTime, files: locations.length, outputs: outputs.size },
      'TileIndex: Manifest Assessed for Duplicates',
    );

    if (args.forceOutput || isArgo()) {
      await fsa.write('/tmp/tile-index-validate/input.geojson', {
        type: 'FeatureCollection',
        features: locations.map((loc) => {
          const epsg = args.sourceEpsg ?? loc.epsg;
          if (epsg == null) {
            logger.error({ source: loc.source }, 'TileIndex:Epsg:missing');
            return;
          }
          return Projection.get(epsg).boundsToGeoJsonFeature(Bounds.fromBbox(loc.bbox), {
            source: loc.source,
            tileName: loc.tileName,
            isDuplicate: (outputs.get(loc.tileName)?.length ?? 1) > 1,
          });
        }),
      });
      await fsa.write('/tmp/tile-index-validate/output.geojson', {
        type: 'FeatureCollection',
        features: [...outputs.values()].map((locs) => {
          const firstLoc = locs[0];
          if (firstLoc == null) throw new Error('Unable to extract tiff locations from: ' + args.location);
          const extract = MapSheet.extract(firstLoc.tileName);
          if (extract == null) throw new Error('Failed to extract tile information from: ' + firstLoc.tileName);
          return Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(extract.bbox), {
            source: locs.map((l) => l.source),
            tileName: firstLoc.tileName,
          });
        }),
      });
      await fsa.write(
        '/tmp/tile-index-validate/file-list.json',
        [...outputs.values()].map((locs) => {
          return { output: locs[0]?.tileName, input: locs.map((l) => l.source) };
        }),
      );
    }

    let duplicateFound = false;
    for (const val of outputs.values()) {
      if (val.length < 2) continue;
      if (args.allowDuplicates) {
        logger.info({ tileName: val[0]?.tileName, uris: val.map((v) => v.source) }, 'TileIndex:Duplicate');
      } else {
        duplicateFound = true;
        logger.error({ tileName: val[0]?.tileName, uris: val.map((v) => v.source) }, 'TileIndex:Duplicate');
      }
    }
    if (duplicateFound) throw new Error(`Duplicate files found, see output.geojson`);
    // TODO do we care if no files are left ??? TODO ask blayne what he meant
  },
});

export function findDuplicates(tiffs: TiffLocation[]): Map<string, TiffLocation[]> {
  const duplicates: Map<string, TiffLocation[]> = new Map();
  for (const loc of tiffs) {
    const uris = duplicates.get(loc.tileName) ?? [];
    uris.push(loc);
    duplicates.set(loc.tileName, uris);
  }
  return duplicates;
}

export interface TiffLocation {
  /** Location to the image */
  source: string;
  /** bbox, [minX, minY, maxX, maxY] */
  bbox: [number, number, number, number];
  /** EPSG code of the tiff if found */
  epsg?: number | null;
  /** Output tile name */
  tileName: string;
}

export async function extractTiffLocations(
  tiffs: CogTiff[],
  scale: number,
  forceEpsg?: number,
): Promise<TiffLocation[]> {
  const result = await Promise.all(
    tiffs.map(async (f): Promise<TiffLocation | null> => {
      try {
        const bbox = await findBoundingBox(f);
        if (bbox == null) throw new Error(`Failed to find Bounding Box/Origin: ${f.source.uri}`);

        const sourceEpsg = forceEpsg ?? f.images[0]?.epsg;
        if (sourceEpsg == null) throw new Error(`EPSG is missing: ${f.source.uri}`);
        const centerX = (bbox[0] + bbox[2]) / 2;
        const centerY = (bbox[1] + bbox[3]) / 2;

        // bbox is not epsg:2193
        const targetProjection = Projection.get(2193);
        const sourceProjection = Projection.get(sourceEpsg);

        const projectedPoint = targetProjection.fromWgs84(sourceProjection.toWgs84([centerX, centerY]));
        const tileName = getTileName(projectedPoint, scale);
        return { bbox, source: f.source.uri, tileName, epsg: f.images[0]?.epsg };
      } catch (e) {
        console.log(f.source.uri, e);
        return null;
      } finally {
        await f.close();
      }
    }),
  );

  const output: TiffLocation[] = [];
  for (const o of result) if (o) output.push(o);
  return output;
}

export function roundWithCorrection(value: number): number {
  if (Number.isInteger(value)) {
    return value;
  }

  // Round to centimeter precision
  let correction = Number(value.toFixed(2));
  const rounded_value = Number(value.toFixed(2));

  if (!Number.isInteger(rounded_value)) {
    if (Number.isInteger(rounded_value + MapSheet.roundCorrection)) {
      correction = rounded_value + MapSheet.roundCorrection;
    } else if (Number.isInteger(rounded_value - MapSheet.roundCorrection)) {
      correction = rounded_value - MapSheet.roundCorrection;
    }
  }

  if (Number.isInteger(correction)) {
    return correction;
  }

  return correction;
}

export function getTileName(origin: number[], grid_size: number): string {
  if (!MapSheet.gridSizes.includes(grid_size)) {
    throw new Error(`The scale has to be one of the following values: ${MapSheet.gridSizes}`);
  }
  const [oX, oY] = origin;
  if (oX == null || Number.isNaN(oX) || oY == null || Number.isNaN(oY)) {
    throw new Error(`Failed to parse origin ${oX},${oY}`);
  }

  const origin_x = roundWithCorrection(oX);
  const origin_y = roundWithCorrection(oY);

  // If x or y is not a round number, the origin is not valid
  if (!Number.isInteger(origin_x) || !Number.isInteger(origin_y)) {
    throw new Error(`The origin is invalid x = ${origin_x}, y = ${origin_y}`);
  }

  const scale = Math.floor(MapSheet.gridSizeMax / grid_size);
  const tile_width = Math.floor(MapSheet.width / scale);
  const tile_height = Math.floor(MapSheet.height / scale);
  let nb_digits = 2;
  if (grid_size === 500) {
    nb_digits = 3;
  }

  if (!(SHEET_MIN_X <= origin_x && origin_x <= SHEET_MAX_X)) {
    throw new Error(`x must be between ${SHEET_MIN_X} and ${SHEET_MAX_X}, was ${origin_x}`);
  }
  if (!(SHEET_MIN_Y <= origin_y && origin_y <= SHEET_MAX_Y)) {
    throw new Error(`y must be between ${SHEET_MIN_Y} and ${SHEET_MAX_Y}, was ${origin_y}`);
  }

  // Do some maths
  const offset_x = Math.round(Math.floor((origin_x - MapSheet.origin.x) / MapSheet.width));
  const offset_y = Math.round(Math.floor((MapSheet.origin.y - origin_y) / MapSheet.height));
  // console.log({ offset_x, offset_y });
  const max_y = MapSheet.origin.y - offset_y * MapSheet.height;
  const min_x = MapSheet.origin.x + offset_x * MapSheet.width;
  const tile_x = Math.round(Math.floor((origin_x - min_x) / tile_width + 1));
  const tile_y = Math.round(Math.floor((max_y - origin_y) / tile_height + 1));
  // console.log({ tile_x, tile_y });

  // Build name
  const letters = Object.keys(SheetRanges)[offset_y];
  const sheet_code = `${letters}${`${offset_x}`.padStart(2, '0')}`;
  const tile_id = `${`${tile_y}`.padStart(nb_digits, '0')}${`${tile_x}`.padStart(nb_digits, '0')}`;
  return `${sheet_code}_${grid_size}_${tile_id}`;
}

// console.log(getTileName([1252480.000, 4830000.000], 1000)); // CH11_1000_0102 -> 01 / 5 =0.2 =1 02 = 0.4 1
// console.log(getTileName([1252480.000, 4830000.000], 5000)); // CH11_5000_0101

// const features = [
//   // Top left of all
//   'CH11_1000_0101',
//   'CH11_1000_0102',

//   // Three points of 1:5k
//   'CH11_1000_0105',
//   'CH11_1000_0501',
//   'CH11_1000_0505',

//   // Three points of 1:10k
//   'CH11_1000_0110',
//   'CH11_1000_1001',
//   'CH11_1000_1010',

//   // Outside our bounds
//   'CH11_1000_1111',
//   // Bigger tiles
//   'CH11_5000_0101',
//   'CH11_10000_0101'
// ].map(f => {
//   const extract = MapSheet.extract(f)
// getTileName(extract.bbox)
//   return Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(extract!.bbox), { source: f })
// })
// console.log(JSON.stringify({ type: 'FeatureCollection', features }));

// const mapTileIndex = MapSheet.extract("CH11_1000_0102")
// console.log("mapTileIndex", mapTileIndex);
// // console.log(Bounds.fromBbox(mapTileIndex.bbox));
// if (mapTileIndex) {
//   console.log(JSON.stringify(Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(mapTileIndex.bbox))));
//   };
// //console.log(getTileName([1252480.000, 4830000.000], 10000)); // CH11_1000_0102

// process.exit() // Kill the application early

// input.geojson -> { source: "s3://foo/bar/baz_tif.tiff", outputTile: "BK23_1000_0505.tiff", isDuplicate: true }
// output.geojson -> { source: ["s3://foo/bar/baz_tif.tiff", ... ], tileName: "BK23_1000_0505.tiff", isDuplicate: true }
