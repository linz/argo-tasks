import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { command, number, option, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { MapSheet, SheetRanges } from '../../utils/mapsheet.js';
import { config, registerCli, verbose } from '../common.js';

const SHEET_MIN_X = MapSheet.origin.x + 4 * MapSheet.width; // The minimum x coordinate of a valid sheet / tile
const SHEET_MAX_X = MapSheet.origin.x + 46 * MapSheet.width; // The maximum x coordinate of a valid sheet / tile
const SHEET_MIN_Y = MapSheet.origin.y - 41 * MapSheet.height; // The minimum y coordinate of a valid sheet / tile
const SHEET_MAX_Y = MapSheet.origin.y; // The maximum y coordinate of a valid sheet / tile

export interface FileList {
  tileName: string;
  uris: string[];
}

export const commandTileNamesValidate = command({
  name: 'file-validate',
  description: 'List input files and validate there are no duplicates.',
  args: {
    config,
    verbose,
    scale: option({ type: number, long: 'scale', description: 'Tile grid scale to align output tile to' }),
    location: option({ type: string, long: 'location', description: 'Location of the manifest file' }),
  },
  handler: async (args) => {
    registerCli(args);
    logger.info('FileValidation:Start');

    const readTiffStartTime = performance.now();
    const data = await fsa.read(args.location);
    const files = JSON.parse(data.toString()).flat();
    await fsa.head(files[0]);
    const tiffs = await Promise.all(files.map((f: string) => new CogTiff(fsa.source(f)).init(true)));
    logger.info({ duration: performance.now() - readTiffStartTime }, 'FileValidation: All Files Read');
    const findDuplicatesStartTime = performance.now();
    const duplicates = findDuplicates(tiffs, args.scale);
    logger.info(
      { duration: performance.now() - findDuplicatesStartTime },
      'FileValidation: Manifest Assessed for Duplicates',
    );
    if (duplicates && duplicates.length > 0) {
      await fsa.write('/tmp/duplicate_file_list.json', JSON.stringify(duplicates));
      throw new Error('Duplicate files found, see output /tmp/file_list.json');
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
