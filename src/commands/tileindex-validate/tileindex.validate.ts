import { Bounds, Projection } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { Size, Tiff, TiffTag } from '@cogeotiff/core';
import { boolean, command, flag, number, option, optional, restPositionals, string, Type } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { FileFilter, getFiles } from '../../utils/chunk.js';
import { findBoundingBox } from '../../utils/geotiff.js';
import { GridSize, GridSizes, MapSheet, MapSheetTileGridSize, SheetRanges } from '../../utils/mapsheet.js';
import { config, createTiff, forceOutput, registerCli, verbose } from '../common.js';
import { CommandListArgs } from '../list/list.js';

export function isTiff(x: string): boolean {
  const search = x.toLowerCase();
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
  async load(locations: string[], args?: FileFilter): Promise<Tiff[]> {
    const files = await getFiles(locations, args);
    const tiffLocations = files.flat().filter(isTiff);
    const startTime = performance.now();
    logger.info({ count: tiffLocations.length }, 'Tiff:Load:Start');
    if (tiffLocations.length === 0) throw new Error('No Files found');
    // Ensure credentials are loaded before concurrently loading tiffs
    if (tiffLocations[0]) await fsa.head(tiffLocations[0]);

    const promises = await Promise.allSettled(
      tiffLocations.map((loc: string) => {
        return createTiff(loc).catch((e: unknown) => {
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
      // We are processing only 8 bits Tiff for now
      output.push(prom.value);
    }
    logger.info({ count: output.length, duration: performance.now() - startTime }, 'Tiffs:Loaded');
    return output;
  },
};

/**
 * Validate list of tiffs match a LINZ map sheet tile index
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

export const GridSizeFromString: Type<string, GridSize> = {
  from(value) {
    const gridSize = Number(value) as GridSize;
    if (!GridSizes.includes(gridSize)) {
      throw new Error(`Invalid grid size "${value}"; valid values: "${GridSizes.join('", "')}"`);
    }
    return Promise.resolve(gridSize);
  },
};

/**
 * Validate the tiffs against a validation preset
 *
 * @param preset preset to validate against
 * @param tiffs tiffs to validate.
 */
async function validatePreset(preset: string, tiffs: Tiff[]): Promise<void> {
  let rejected: boolean = false;

  if (preset === 'webp') {
    const promises = tiffs.map((f) => validate8BitsTiff(f));
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'rejected') {
        rejected = true;
        logger.fatal({ reason: r.reason as string }, 'Tiff:ValidatePreset:failed');
      }
    }
  }

  if (rejected) throw new Error('Tiff preset validation failed');
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
export const commandTileIndexValidate = command({
  name: 'tileindex-validate',
  description: 'List input files and validate there are no duplicates.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    include: CommandListArgs.include,
    scale: option({ type: GridSizeFromString, long: 'scale', description: 'Tile grid scale to align output tile to' }),
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
    preset: option({
      type: string,
      long: 'preset',
      description: 'Validate the input tiffs with a configuration preset',
      defaultValueIsSerializable: true,
      defaultValue: () => 'none',
    }),
    location: restPositionals({ type: string, displayName: 'location', description: 'Location of the source files' }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('TileIndex:Start');

    const readTiffStartTime = performance.now();
    const tiffs = await TiffLoader.load(args.location, args);
    await validatePreset(args.preset, tiffs);

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
      logger.info({ path: '/tmp/tile-index-validate/output.geojson' }, 'Write:InputGeoJson');

      await fsa.write('/tmp/tile-index-validate/output.geojson', {
        type: 'FeatureCollection',
        features: [...outputs.values()].map((locs) => {
          const firstLoc = locs[0];
          if (firstLoc == null) throw new Error('Unable to extract tiff locations from: ' + args.location.join(', '));
          const mapTileIndex = MapSheet.getMapTileIndex(firstLoc.tileName);
          if (mapTileIndex == null) throw new Error('Failed to extract tile information from: ' + firstLoc.tileName);
          return Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(mapTileIndex.bbox), {
            source: locs.map((l) => l.source),
            tileName: firstLoc.tileName,
          });
        }),
      });
      logger.info({ path: '/tmp/tile-index-validate/output.geojson' }, 'Write:OutputGeojson');

      await fsa.write(
        '/tmp/tile-index-validate/file-list.json',
        [...outputs.values()].map((locs) => {
          return { output: locs[0]?.tileName, input: locs.map((l) => l.source) };
        }),
      );
      logger.info({ path: '/tmp/tile-index-validate/file-list.json', count: outputs.size }, 'Write:FileList');
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
      let allValid = true;
      for (const tiff of locations) {
        const currentValid = validateTiffAlignment(tiff);
        allValid = allValid && currentValid;
      }
      if (!allValid) throw new Error(`Tile alignment validation failed`);
    }

    if (retileNeeded) throw new Error(`Duplicate files found, see output.geojson`);
    // TODO do we care if no files are left?

    logger.info({ duration: performance.now() - startTime }, 'TileIndex:Done');
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
 * Create a list of `TiffLocation` from a list of TIFFs (`CogTiff`) by extracting their bounding box and generated their tile name from their origin based on a provided `GridSize`.
 *
 * @param tiffs
 * @param gridSize
 * @param forceSourceEpsg
 * @returns {TiffLocation[]}
 */
export async function extractTiffLocations(
  tiffs: Tiff[],
  gridSize: GridSize,
  forceSourceEpsg?: number,
): Promise<TiffLocation[]> {
  const result = await Promise.all(
    tiffs.map(async (tiff): Promise<TiffLocation | null> => {
      try {
        const bbox = await findBoundingBox(tiff);

        const sourceEpsg = forceSourceEpsg ?? tiff.images[0]?.epsg;
        if (sourceEpsg == null) {
          logger.error({ reason: 'EPSG is missing', source: tiff.source }, 'MissingEPSG:ExtracTiffLocations:Failed');
          return null;
        }

        const centerX = (bbox[0] + bbox[2]) / 2;
        const centerY = (bbox[1] + bbox[3]) / 2;
        // bbox is not epsg:2193
        const targetProjection = Projection.get(2193);
        const sourceProjection = Projection.get(sourceEpsg);

        const [x, y] = targetProjection.fromWgs84(sourceProjection.toWgs84([centerX, centerY]));
        if (x == null || y == null) {
          logger.error(
            { reason: 'Failed to reproject point', source: tiff.source },
            'Reprojection:ExtracTiffLocations:Failed',
          );
          return null;
        }

        // Tilename from center
        const tileName = getTileName(x, y, gridSize);

        // if (shouldValidate) {
        //   // Is the tiff bounding box the same as the map sheet bounding box!
        //   // Also need to allow for ~1.5cm of error between bounding boxes.
        //   // assert bbox == MapSheet.getMapTileIndex(tileName).bbox
        // }
        return { bbox, source: tiff.source.url.href, tileName, epsg: tiff.images[0]?.epsg };
      } catch (e) {
        logger.error({ reason: e, source: tiff.source }, 'ExtractTiffLocation:Failed');
        return null;
      } finally {
        await tiff.source.close?.();
      }
    }),
  );

  const output: TiffLocation[] = [];
  for (const o of result) {
    if (o === null) throw new Error('All TIFF locations have not been extracted.');
    output.push(o);
  }

  return output;
}
export function getSize(extent: [number, number, number, number]): Size {
  return { width: extent[2] - extent[0], height: extent[3] - extent[1] };
}

export function validateTiffAlignment(tiff: TiffLocation, allowedError = 0.015): boolean {
  const mapTileIndex = MapSheet.getMapTileIndex(tiff.tileName);
  if (mapTileIndex == null) {
    logger.error(
      { reason: `Failed to extract bounding box from: ${tiff.tileName}`, source: tiff.source },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }
  // Top Left
  const errX = Math.abs(tiff.bbox[0] - mapTileIndex.bbox[0]);
  const errY = Math.abs(tiff.bbox[3] - mapTileIndex.bbox[3]);
  if (errX > allowedError || errY > allowedError) {
    logger.error(
      { reason: `The origin is invalid x:${tiff.bbox[0]}, y:${tiff.bbox[3]}`, source: tiff.source },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }

  // TODO do we validate bottom right
  const tiffSize = getSize(tiff.bbox);
  if (tiffSize.width !== mapTileIndex.width) {
    logger.error(
      { reason: `Tiff size is invalid width:${tiffSize.width}, expected:${mapTileIndex.width}`, source: tiff.source },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }

  if (tiffSize.height !== mapTileIndex.height) {
    logger.error(
      {
        reason: `Tiff size is invalid height:${tiffSize.height}, expected:${mapTileIndex.height}`,
        source: tiff.source,
      },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }

  return true;
}

export function getTileName(x: number, y: number, gridSize: GridSize): string {
  const offsetX = Math.round(Math.floor((x - MapSheet.origin.x) / MapSheet.width));
  const offsetY = Math.round(Math.floor((MapSheet.origin.y - y) / MapSheet.height));

  // Build name
  const letters = Object.keys(SheetRanges)[offsetY];
  const sheetCode = `${letters}${`${offsetX}`.padStart(2, '0')}`;
  // TODO: re-enable this check when validation logic
  // if (!MapSheet.isKnown(sheetCode)) throw new Error('Map sheet outside known range: ' + sheetCode);

  // Shorter tile names for 1:50k
  if (gridSize === MapSheetTileGridSize) return sheetCode;

  const tilesPerMapSheet = Math.floor(MapSheet.gridSizeMax / gridSize);
  const tileWidth = Math.floor(MapSheet.width / tilesPerMapSheet);
  const tileHeight = Math.floor(MapSheet.height / tilesPerMapSheet);

  const nbDigits = gridSize === 500 ? 3 : 2;

  const maxY = MapSheet.origin.y - offsetY * MapSheet.height;
  const minX = MapSheet.origin.x + offsetX * MapSheet.width;
  const tileX = Math.round(Math.floor((x - minX) / tileWidth + 1));
  const tileY = Math.round(Math.floor((maxY - y) / tileHeight + 1));
  const tileId = `${`${tileY}`.padStart(nbDigits, '0')}${`${tileX}`.padStart(nbDigits, '0')}`;
  return `${sheetCode}_${gridSize}_${tileId}`;
}

/**
 * Validate if a TIFF contains only 8 bits bands.
 *
 * @param tiff
 */
export async function validate8BitsTiff(tiff: Tiff): Promise<void> {
  const baseImage = tiff.images[0];
  if (baseImage === undefined) throw new Error(`Can't get base image for ${tiff.source.url.href}`);

  const bitsPerSample = await baseImage.fetch(TiffTag.BitsPerSample);
  if (bitsPerSample == null) {
    throw new Error(`Failed to extract band information from ${tiff.source.url.href}`);
  }

  if (!bitsPerSample.every((currentNumberBits) => currentNumberBits === 8)) {
    throw new Error(`${tiff.source.url.href} is not a 8 bits TIFF`);
  }
}
