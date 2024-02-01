import { Bounds, Projection } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { CogTiff, Size } from '@cogeotiff/core';
import { boolean, command, flag, number, option, optional, restPositionals } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { FileFilter, getFiles } from '../../utils/chunk.js';
import { PathStringOrUrlStringFromString } from '../../utils/cmd-ts-types.js';
import { findBoundingBox } from '../../utils/geotiff.js';
import { MapSheet, SheetRanges } from '../../utils/mapsheet.js';
import { PathString, UrlString } from '../../utils/types.js';
import { config, createTiff, forceOutput, registerCli, verbose } from '../common.js';
import { CommandListArgs } from '../list/list.js';

const SHEET_MIN_X = MapSheet.origin.x + 4 * MapSheet.width; // The minimum x coordinate of a valid sheet / tile
const SHEET_MAX_X = MapSheet.origin.x + 46 * MapSheet.width; // The maximum x coordinate of a valid sheet / tile
const SHEET_MIN_Y = MapSheet.origin.y - 41 * MapSheet.height; // The minimum y coordinate of a valid sheet / tile
const SHEET_MAX_Y = MapSheet.origin.y; // The maximum y coordinate of a valid sheet / tile

export function isTiff(path: PathString | UrlString): boolean {
  const search = path.toLowerCase();
  return search.endsWith('.tiff') || search.endsWith('.tif');
}

export const TiffLoader = {
  /**
   * Concurrently load a collection of tiffs in the locations provided.
   *
   * @param locations list of locations to find tiffs in.
   * @param args filter the tiffs
   * @returns Initialized tiff
   */
  async load(locations: (PathString | UrlString)[], args?: FileFilter): Promise<CogTiff[]> {
    const files = await getFiles(locations, args);
    const tiffLocations = files.flat().filter(isTiff);
    if (tiffLocations.length === 0) throw new Error('No Files found');
    // Ensure credentials are loaded before concurrently loading tiffs
    if (tiffLocations[0]) await fsa.head(tiffLocations[0]);

    const promises = await Promise.allSettled(
      tiffLocations.map((loc: string) => {
        return createTiff(loc).catch((e) => {
          // Ensure tiff loading errors include the location of the tiff
          logger.fatal({ source: loc, err: e }, 'Tiff:Load:Failed');
          throw e;
        });
      }),
    );
    // Ensure all the tiffs loaded successfully
    const output = [];
    for (const prom of promises) {
      // All the errors are logged above so just throw the first error
      if (prom.status === 'rejected') throw new Error('Tiff loading failed: ' + String(prom.reason));
      output.push(prom.value);
    }
    return output;
  },
};

/**
 * Validate list of tiffs match a LINZ Mapsheet tile index
 *
 * If --validate
 * Asserts that there will be no duplicates
 *
 * If --retile
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
 * Validate all source tiffs align to scale grid
 *
 * ```bash
 * tileindex-validate --scale 5000 --validate s3://linz-imagery/auckland/auckland_2010-2012_0.5m/rgb/2193/
 * ```
 *
 * Create a list of files that need to be retiled
 * ```bash
 * tileindex-validate --scale 5000 --retile ./path/to/imagery/
 * ```
 */

export const commandTileIndexValidate = command({
  name: 'tileindex-validate',
  description: 'List input files and validate there are no duplicates.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    include: CommandListArgs.include,
    scale: option({ type: number, long: 'scale', description: 'Tile grid scale to align output tile to' }),
    sourceEpsg: option({ type: optional(number), long: 'source-epsg', description: 'Force epsg code for input tiffs' }),
    retile: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'retile',
      description: 'Output tile configuration for retiling',
      defaultValueIsSerializable: true,
    }),
    validate: flag({
      type: boolean,
      defaultValue: () => true,
      long: 'validate',
      description: 'Validate that all input tiffs perfectly align to tile grid',
      defaultValueIsSerializable: true,
    }),
    forceOutput,
    location: restPositionals({
      type: PathStringOrUrlStringFromString,
      displayName: 'location',
      description: 'Location of the source files',
    }),
  },
  async handler(args) {
    registerCli(this, args);
    logger.info('TileIndex:Start');

    const readTiffStartTime = performance.now();
    const tiffs = await TiffLoader.load(args.location, args);

    const projections = new Set(tiffs.map((t) => t.images[0]?.epsg));
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

    const groupByTileNameStartTime = performance.now();
    const locations = await extractTiffLocations(tiffs, args.scale, args.sourceEpsg);
    const outputs = groupByTileName(locations);

    logger.info(
      { duration: performance.now() - groupByTileNameStartTime, files: locations.length, outputs: outputs.size },
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
          const mapTileIndex = MapSheet.getMapTileIndex(firstLoc.tileName);
          if (mapTileIndex == null) throw new Error('Failed to extract tile information from: ' + firstLoc.tileName);
          return Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(mapTileIndex.bbox), {
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

    let retileNeeded = false;
    for (const val of outputs.values()) {
      if (val.length < 2) continue;
      if (args.retile) {
        logger.info({ tileName: val[0]?.tileName, uris: val.map((v) => v.source) }, 'TileIndex:Retile');
      } else {
        retileNeeded = true;
        logger.error({ tileName: val[0]?.tileName, uris: val.map((v) => v.source) }, 'TileIndex:Duplicate');
      }
    }

    // Validate that all tiffs align to tile grid
    if (args.validate) {
      let validationFailed = false;
      for (const tiff of locations) {
        const ret = validateTiffAlignment(tiff);
        if (ret === true) continue;
        logger.error({ reason: ret.message, source: tiff.source }, 'TileInvalid:Validation:Failed');
        validationFailed = true;
      }
      if (validationFailed) throw new Error(`Tile alignment validation failed`);
    }

    if (retileNeeded) throw new Error(`Duplicate files found, see output.geojson`);
    // TODO do we care if no files are left?
  },
});

export function groupByTileName(tiffs: TiffLocation[]): Map<string, TiffLocation[]> {
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

/**
 *
 * --validate // Validates all inputs align to output grid
 * --retile // Creates a list of files that need to be retiled
 *
 *
 * input: 1:1000
 * scale: 1:1000
 * // --retile=false --validate=true
 * // Validate the top left points of every input align to the 1:1000 grid and no duplicates
 *
 * input: 1:1000
 * scale: 1:1000
 * // --retile=true --validate=true
 * // Merges duplicate tiffs together the top left points of every input align to the 1:1000 grid and no duplicates
 *
 * input: 1:1000
 * scale: 1:5000, 1:10_000
 * // --retile=true --validate=false
 * // create a re-tiling output of {tileName, input: string[] }
 *
 * -- Not handled (yet!)
 * input: 1:10_000
 * scale: 1:1000
 * // create a re-tiling output of  1 input tiff = 100x {tileName, input: string}[]
 *
 */
export async function extractTiffLocations(
  tiffs: CogTiff[],
  gridSize: number,
  forceSourceEpsg?: number,
): Promise<TiffLocation[]> {
  const result = await Promise.all(
    tiffs.map(async (tiff): Promise<TiffLocation | null> => {
      try {
        const bbox = await findBoundingBox(tiff);

        const sourceEpsg = forceSourceEpsg ?? tiff.images[0]?.epsg;
        if (sourceEpsg == null) throw new Error(`EPSG is missing: ${tiff.source.url}`);
        const centerX = (bbox[0] + bbox[2]) / 2;
        const centerY = (bbox[1] + bbox[3]) / 2;
        // bbox is not epsg:2193
        const targetProjection = Projection.get(2193);
        const sourceProjection = Projection.get(sourceEpsg);

        const [x, y] = targetProjection.fromWgs84(sourceProjection.toWgs84([centerX, centerY]));
        if (x == null || y == null) throw new Error(`Failed to reproject point: ${tiff.source.url}`);
        // Tilename from center
        const tileName = getTileName(x, y, gridSize);

        // if (shouldValidate) {
        //   // Is the tiff bounding box the same as the mapsheet bounding box!
        //   // Also need to allow for ~1.5cm of error between bounding boxes.
        //   // assert bbox == MapSheet.extract(tileName).bbox
        // }
        return { bbox, source: tiff.source.url.href, tileName, epsg: tiff.images[0]?.epsg };
      } catch (e) {
        console.log(tiff.source.url, e);
        return null;
      } finally {
        await tiff.source.close?.();
      }
    }),
  );

  const output: TiffLocation[] = [];
  for (const o of result) if (o) output.push(o);
  return output;
}

export function getSize(extent: [number, number, number, number]): Size {
  return { width: extent[2] - extent[0], height: extent[3] - extent[1] };
}

export function validateTiffAlignment(tiff: TiffLocation, allowedError = 0.015): true | Error {
  const mapTileIndex = MapSheet.getMapTileIndex(tiff.tileName);
  if (mapTileIndex == null) throw new Error('Failed to extract bounding box from: ' + tiff.tileName);
  // Top Left
  const errX = Math.abs(tiff.bbox[0] - mapTileIndex.bbox[0]);
  const errY = Math.abs(tiff.bbox[3] - mapTileIndex.bbox[3]);
  if (errX > allowedError || errY > allowedError)
    return new Error(`The origin is invalid x:${tiff.bbox[0]}, y:${tiff.bbox[3]} source:${tiff.source}`);

  // TODO do we validate bottom right
  const tiffSize = getSize(tiff.bbox);
  if (tiffSize.width !== mapTileIndex.width)
    return new Error(
      `Tiff size is invalid width:${tiffSize.width}, expected:${mapTileIndex.width} source:${tiff.source}`,
    );
  if (tiffSize.height !== mapTileIndex.height)
    return new Error(
      `Tiff size is invalid height:${tiffSize.height}, expected:${mapTileIndex.height} source:${tiff.source}`,
    );
  return true;
}

export function getTileName(originX: number, originY: number, gridSize: number): string {
  if (!MapSheet.gridSizes.includes(gridSize)) {
    throw new Error(`The scale has to be one of the following values: ${MapSheet.gridSizes}`);
  }

  const tilesPerMapSheet = Math.floor(MapSheet.gridSizeMax / gridSize);
  const tileWidth = Math.floor(MapSheet.width / tilesPerMapSheet);
  const tileHeight = Math.floor(MapSheet.height / tilesPerMapSheet);
  let nbDigits = 2;
  if (gridSize === 500) {
    nbDigits = 3;
  }

  if (!(SHEET_MIN_X <= originX && originX <= SHEET_MAX_X)) {
    throw new Error(`x must be between ${SHEET_MIN_X} and ${SHEET_MAX_X}, was ${originX}`);
  }
  if (!(SHEET_MIN_Y <= originY && originY <= SHEET_MAX_Y)) {
    throw new Error(`y must be between ${SHEET_MIN_Y} and ${SHEET_MAX_Y}, was ${originY}`);
  }

  // Do some maths
  const offsetX = Math.round(Math.floor((originX - MapSheet.origin.x) / MapSheet.width));
  const offsetY = Math.round(Math.floor((MapSheet.origin.y - originY) / MapSheet.height));
  const maxY = MapSheet.origin.y - offsetY * MapSheet.height;
  const minX = MapSheet.origin.x + offsetX * MapSheet.width;
  const tileX = Math.round(Math.floor((originX - minX) / tileWidth + 1));
  const tileY = Math.round(Math.floor((maxY - originY) / tileHeight + 1));

  // Build name
  const letters = Object.keys(SheetRanges)[offsetY];
  const sheetCode = `${letters}${`${offsetX}`.padStart(2, '0')}`;
  const tileId = `${`${tileY}`.padStart(nbDigits, '0')}${`${tileX}`.padStart(nbDigits, '0')}`;
  return `${sheetCode}_${gridSize}_${tileId}`;
}
