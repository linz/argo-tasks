import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { command, number, option, optional, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { getFiles } from '../../utils/chunk.js';
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
    await fsa.head(tiffFiles[0]);
    const tiffs = await Promise.all(tiffFiles.map((f: string) => new CogTiff(fsa.source(f)).init(true)));
    logger.info({ duration: performance.now() - readTiffStartTime }, 'TileIndex: All Files Read');
    const findDuplicatesStartTime = performance.now();
    const duplicates = findDuplicates(tiffs, args.scale);
    logger.info(
      { duration: performance.now() - findDuplicatesStartTime },
      'TileIndex: Manifest Assessed for Duplicates',
    );

    if (args.output) await fsa.write(args.output, JSON.stringify(files));
    if (duplicates && duplicates.length > 0) {
      for (const d of duplicates) logger.warn({ tileName: d.tileName, uris: d.uris }, 'TileIndex:Duplicate');
      if (args.duplicatesOutput) await fsa.write(args.duplicatesOutput, JSON.stringify(duplicates, null, 2));
      throw new Error('Duplicate files found, see output /tmp/duplicate_file_list.json');
    }
  },
});

export function findDuplicates(tiffs: CogTiff[], scale: number): FileList[] {
  const seen = new Map<string, string[]>();
  const duplicates: FileList[] = [];
  for (const f of tiffs) {
    const uri = f.source.uri;
    const tileName = getTileName(f.images[0].origin, scale);
    const existingUri = seen.get(tileName) ?? [];
    existingUri.push(uri);
    if (existingUri.length === 2) duplicates.push({ tileName, uris: existingUri });
    seen.set(tileName, existingUri);
  }
  return duplicates;
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

  const origin_x = roundWithCorrection(origin[0]);
  const origin_y = roundWithCorrection(origin[1]);

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
  const max_y = MapSheet.origin.y - offset_y * MapSheet.height;
  const min_x = MapSheet.origin.x + offset_x * MapSheet.width;
  const tile_x = Math.round(Math.floor((origin_x - min_x) / tile_width + 1));
  const tile_y = Math.round(Math.floor((max_y - origin_y) / tile_height + 1));
  // Build name
  const letters = Object.keys(SheetRanges)[offset_y];
  const sheet_code = `${letters}${`${offset_x}`.padStart(2, '0')}`;
  const tile_id = `${`${tile_y}`.padStart(nb_digits, '0')}${`${tile_x}`.padStart(nb_digits, '0')}`;
  return `${sheet_code}_${grid_size}_${tile_id}`;
}
