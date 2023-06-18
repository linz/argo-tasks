import { Bounds } from '@basemaps/geo';
import { Projection } from '@basemaps/shared/build/proj/projection.js';
import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { boolean, command, flag, number, option, optional, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { getFiles } from '../../utils/chunk.js';
import { findBoundingBox } from '../../utils/geotiff.js';
import { MapSheet, SheetRanges } from '../../utils/mapsheet.js';
import { registerCli } from '../common.js';
import { CommandListArgs } from '../list/list.js';


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
    ...CommandListArgs,
    scale: option({ type: number, long: 'scale', description: 'Tile grid scale to align output tile to' }),
    allowDuplicates: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'allow-duplicates',
      description: 'Allow Duplicates for Merging',
    }),
    duplicatesOutput: option({
      type: optional(string),
      long: 'duplicates-output',
      description: 'Output location for the listing',
    }),
  },
  handler: async (args) => {
    registerCli(args);
    logger.info('TileIndex:Start');

    const readTiffStartTime = performance.now();
    const files = await getFiles(args.location, args);
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

    const findDuplicatesStartTime = performance.now(); // TODO change name of const
    const seen = await tempNameForAllowDuplicates(tiffs, args.scale);

    logger.info(
      { duration: performance.now() - findDuplicatesStartTime },
      'TileIndex: Manifest Assessed for Duplicates',
    ); // TODO change/move (will need x2) log message

    // bounds geojson -> fsa.write...  == info file (do we always want this?)
    // if allow-duplicates
    // seen -> [[files], [files]] -> fsa.write(args.output, JSON.stringify(seen)) == standardising input
    // else
    // if duplicates
    // throw new Error(`Duplicate files found, see bounds geojson`); == stop workflow
    // else
    // if (args.output) await fsa.write(args.output, JSON.stringify(files)); == standardising input


    const target = [];
    for (const tileName of seen.keys()) {
      const mapTileIndex = MapSheet.extract(tileName)
      if (mapTileIndex) {
        target.push(
          Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(mapTileIndex.bbox), { tilename: tileName, source: seen.get(tileName) ?? [] }),
        );
      }
      fsa.write(
        './target-bounds.geojson',
        JSON.stringify({
          type: 'FeatureCollection',
          features: target,
        }),
      );
    }
    if (args.allowDuplicates) {
      console.log(seen);
      // Code to change argo split from aws-list group to new tiles?
    } else {
      if (args.output) await fsa.write(args.output, JSON.stringify(files));
      const duplicates = findDuplicates(seen);
      if (duplicates && duplicates.length > 0) {
        for (const d of duplicates) logger.warn({ tileName: d.tileName, uris: d.uris }, 'TileIndex:Duplicate'); // is this useful or will people just use the geojson?
        if (args.duplicatesOutput) await fsa.write(args.duplicatesOutput, JSON.stringify(duplicates, null, 2)); // remove - superceeded by geojson?
        throw new Error(
          `Duplicate files found, if '--duplicates-output' specified see output: ${args.duplicatesOutput}`,
        );
      }
    }
  },
});

export function findDuplicates(tiffs: Map<string, string[]>): FileList[] {
  const duplicates: FileList[] = [];
  for (const tileName of tiffs.keys()) {
    const uris = tiffs.get(tileName) ?? [];
    if (uris.length >= 2) duplicates.push({ tileName, uris: uris });
  }
  return duplicates;
}

// TODO fix name of function
export async function tempNameForAllowDuplicates(tiffs: CogTiff[], scale: number): Promise<Map<string, string[]>> {
  const seen = new Map<string, string[]>();
  const output = [];
  for (const f of tiffs) {
    const uri = f.source.uri;
    const firstImage = f.images[0];
    if (firstImage == null) throw new Error(`Failed to parse tiff: ${f.source.uri}`);
    if (firstImage.epsg !== 2193) throw new Error(`Invalid projection tiff: ${f.source.uri} EPSG:${firstImage.epsg}`);
    // output.push(
    //   Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(firstImage.bbox), { source: f.source.uri, tilename: tileName }),
    // );
    try {
      const bbox = await findBoundingBox(f);
      if (bbox == null) throw new Error(`Failed to find Bounding Box/Origin: ${f.source.uri}`);
      const tileName = getTileName([bbox[0], bbox[3]], scale);

      const tiffBbox = f.images[0]!.bbox;
      console.log(
        getTileName([bbox[0], bbox[3]], scale),
        getTileName([bbox[2], bbox[1]], scale),
        getTileName([tiffBbox[0], tiffBbox[1]], scale)
      )
      output.push(
        Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(firstImage.bbox), { source: f.source.uri, tilename: tileName }),
      );
      const existingUri = seen.get(tileName) ?? [];
      existingUri.push(uri);
      seen.set(tileName, existingUri);
    } catch (e) {
      console.log(f.source.uri, e);
    }
    f.close();
  }
  // source geojson
  fsa.write(
    './bounds.geojson',
    JSON.stringify({
      type: 'FeatureCollection',
      features: output,
    }),
  );
  return seen;
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
  console.log({ offset_x, offset_y })
  const max_y = MapSheet.origin.y - offset_y * MapSheet.height;
  const min_x = MapSheet.origin.x + offset_x * MapSheet.width;
  const tile_x = Math.round(Math.floor((origin_x - min_x) / tile_width + 1));
  const tile_y = Math.round(Math.floor((max_y - origin_y) / tile_height + 1));
  console.log({ tile_x, tile_y })

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

