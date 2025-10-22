import { Bounds, Projection } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import type { Size, Tiff } from '@cogeotiff/core';
import { TiffTag } from '@cogeotiff/core';
import type { BBox } from '@linzjs/geojson';
import type { Type } from 'cmd-ts';
import { boolean, command, flag, number, option, optional, restPositionals, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { isArgo } from '../../utils/argo.ts';
import { extractBandInformation } from '../../utils/band.ts';
import type { FileFilter } from '../../utils/chunk.ts';
import { getFiles } from '../../utils/chunk.ts';
import { createFileList, protocolAwareString } from '../../utils/filelist.ts';
import { findBoundingBox } from '../../utils/geotiff.ts';
import type { GridSize } from '../../utils/mapsheet.ts';
import { GridSizes, MapSheet, MapSheetTileGridSize } from '../../utils/mapsheet.ts';
import { config, createTiff, forceOutput, registerCli, UrlFolderList, urlPathEndsWith, verbose } from '../common.ts';
import { CommandListArgs } from '../list/list.ts';

export const TiffLoader = {
  /**
   * Concurrently load a collection of tiffs in the locations provided.
   *
   * @param locations list of locations to find tiffs in.
   * @param args filter the tiffs
   * @returns Initialized tiff
   */
  async load(locations: URL[], args?: FileFilter): Promise<Tiff[]> {
    // Include 0 byte files and filter them out based on file extension
    const files = await getFiles(locations, { ...args, sizeMin: 0 });
    const tiffLocations = files.flat().filter((f) => urlPathEndsWith(f, '.tiff') || urlPathEndsWith(f, '.tif'));
    const startTime = performance.now();
    logger.info({ count: tiffLocations.length }, 'Tiff:Load:Start');
    if (tiffLocations.length === 0) throw new Error('No Files found');
    // Ensure credentials are loaded before concurrently loading tiffs
    if (tiffLocations[0]) await fsa.head(tiffLocations[0]);

    const promises = await Promise.allSettled(
      tiffLocations.map((loc: URL) => {
        return createTiff(loc).catch((e: unknown) => {
          // Ensure tiff loading errors include the location of the tiff
          logger.fatal({ source: protocolAwareString(loc), err: e }, 'Tiff:Load:Failed');
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

export const GridSizeFromString: Type<string, GridSize | 'auto'> = {
  async from(value) {
    if (value === 'auto') return value;
    const gridSize = Number(value) as GridSize;
    if (!GridSizes.includes(gridSize)) {
      throw new Error(`Invalid grid size "${value}"; valid values: "${GridSizes.join('", "')}", or "auto"`);
    }
    return gridSize;
  },
};

const autoBooleanFromString = (parameterName: string): Type<string, 'auto' | boolean> => ({
  async from(value): Promise<'auto' | boolean> {
    if (value === 'auto') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Invalid ${parameterName} value "${value}"; valid values: "auto", "true", "false"`);
  },
});

/**
 * Determine the grid size from tiff dimensions
 *
 * @param width Width of the tiff in meters
 * @param height Height of the tiff in meters
 * @returns GridSize if dimensions match a known tile size, null otherwise
 */
export function determineGridSizeFromDimensions(width: number, height: number): GridSize | null {
  for (const gridSize of GridSizes) {
    // MapSheet has base dimensions at 50k scale, smaller scales divide by the ratio
    const scale = MapSheet.scale / gridSize;
    const expectedWidth = MapSheet.width / scale;
    const expectedHeight = MapSheet.height / scale;

    if (width === expectedWidth && height === expectedHeight) {
      return gridSize;
    }
  }
  return null;
}

/**
 * Determine the grid size from the GSD and preset (datatype)
 *
 * @param gsd Ground Sample Distance in meters
 * @param preset 'webp' for aerial imagery, 'dem_lerc' for DEM/DSM/Hillshade
 */
export function determineGridSizeFromGSDPreset(gsd: number, preset: string): GridSize {
  // Aerial Imagery
  if (preset === 'webp') {
    if (gsd < 0.1) return 1000;
    if (gsd >= 0.1 && gsd < 0.25) return 5000;
    if (gsd >= 0.25 && gsd < 1.0) return 10000;
    if (gsd >= 1.0) return 50000;
  }
  // DEM/DSM/Hillshade
  if (preset === 'dem_lerc') {
    if (gsd < 0.2) return 1000;
    if (gsd >= 0.2 && gsd <= 1.0) return 10000;
    if (gsd > 1.0) return 50000;
  }

  throw new Error(`Unknown preset: ${preset}`);
}

/**
 * Validate the tiffs against a validation preset
 *
 * @param preset preset to validate against
 * @param tiffs tiffs to validate.
 */
export async function validatePreset(preset: string, tiffs: Tiff[]): Promise<void> {
  let rejected = false;

  if (preset === 'webp') {
    const promises = tiffs.map((f) => {
      return validate8BitsTiff(f).catch((err) => {
        logger.fatal(
          { reason: String(err), source: protocolAwareString(f.source.url), preset },
          'Tiff:ValidatePreset:failed',
        );
        rejected = true;
      });
    });
    await Promise.allSettled(promises);
  }

  if (rejected) throw new Error(`Tiff preset:"${preset}" validation failed`);
}

/**
 * Validate list of tiffs match a LINZ map sheet tile index
 *
 * If --validate
 * Asserts that there will be no duplicates (when tiffs have same scale as output scale and --retile is auto)
 *
 * Automatic retiling behavior (--retile):
 * - "auto" (default): Intelligent retiling - only retiles when tiffs have different scales than output scale
 * - true: Always processes duplicates for retiling regardless of scale matching
 * - false: Never retiles duplicates
 *
 * If --includeDerived
 * Sets includeDerived in file-list.json (determines whether to create derived_from links in STAC)
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
 * Filelist grouped by target tileNames with includeDerived flag
 *
 * Attributes:
 * - input (string[]): paths to source tiffs
 * - output (string): target tileName for target tile index
 * - includeDerived (boolean): include input tiles as STAC `derived_from` links
 *
 * @example
 * Validate all source tiffs align to scale grid
 *
 * ```bash
 * tileindex-validate --scale 5000 --validate s3://linz-imagery/auckland/auckland_2010-2012_0.5m/rgb/2193/
 * ```
 *
 * Create a list of files for retiling (automatically determined based on input vs output grid size)
 * ```bash
 * tileindex-validate --scale 5000 ./path/to/imagery/
 * ```
 *
 * Force retiling of duplicate sources regardless of grid size matching
 * ```bash
 * tileindex-validate --scale 1000 --retile true ./path/to/imagery/
 * ```
 */
/**
 * Retiling behavior based on tiff scale vs output scale:
 *
 * Case 1: Duplicate tiffs have same scale as output scale + --retile auto (default)
 * → Reports duplicates as errors (no retiling)
 *
 * Case 2: --retile true OR duplicate tiffs have different scale than output scale
 * → Creates retiling output with duplicate tiffs merged
 *
 * Examples:
 * input: 1:1000 tiffs, scale: 1:1000 → error on duplicates (same scale, auto retiling)
 * input: 1:1000 tiffs, scale: 1:1000, --retile true → create retiling output
 * input: 1:1000 tiffs, scale: 1:5000 → create retiling output (different scale, auto retiling)
 * input: mixed 1:1000 + 1:5000 tiffs, scale: 1:1000 → create retiling output (mixed scales, auto retiling)
 *
 * -- Not handled (yet!)
 * input: 1:10_000, scale: 1:1000 → split input tiff into multiple output tiles
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
    scale: option({
      type: GridSizeFromString,
      long: 'scale',
      description:
        'Tile grid scale to align output tile to. "auto" determines the appropriate scale based on input TIFFs GSD and preset.',
      defaultValueIsSerializable: true,
      defaultValue: () => 'auto' as const,
    }),
    sourceEpsg: option({ type: optional(number), long: 'source-epsg', description: 'Force epsg code for input tiffs' }),
    validate: option({
      type: autoBooleanFromString('validate'),
      defaultValue: () => 'auto' as const,
      long: 'validate',
      description: 'Validate that all input tiffs perfectly align to tile grid. "auto" skips validation when retiling.',
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
    includeDerived: flag({
      type: boolean,
      long: 'includeDerived',
      description: 'Include input tiles as STAC `derived_from` links',
      defaultValueIsSerializable: true,
      defaultValue: () => false,
    }),
    retile: option({
      type: autoBooleanFromString('retile'),
      long: 'retile',
      description:
        'Re-tile input TIFFs to an output tile. "auto" enables intelligent re-tiling based on input vs output scales.',
      defaultValueIsSerializable: true,
      defaultValue: () => 'auto' as const,
    }),
    location: restPositionals({
      type: UrlFolderList,
      displayName: 'location',
      description: 'Location of the source files. Accepts multiple source paths.',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('TileIndex:Start');

    const readTiffStartTime = performance.now();
    const tiffLocationsToLoad = args.location.flat();
    const tiffs = await TiffLoader.load(tiffLocationsToLoad, args);
    await validatePreset(args.preset, tiffs);

    const projections = new Set();
    const gsds = new Set();
    const roundedGsds = new Set();
    tiffs.forEach((t) => {
      const image = t.images[0];
      if (image) {
        projections.add(image.epsg);
        gsds.add(image.resolution[0]);
        roundedGsds.add((Math.round(image.resolution[0] * 200) / 200).toString()); // Round to nearest 0.005
      }
    });
    logger.info(
      {
        tiffCount: tiffs.length,
        projections: [...projections],
        gsds: [...gsds],
        duration: performance.now() - readTiffStartTime,
      },
      'TileIndex: All Files Read',
    );

    if (projections.size > 1) {
      logger.warn({ projections: [...projections] }, 'TileIndex:InconsistentProjections');
    }
    if (roundedGsds.size > 1) {
      if (args.validate === true) {
        logger.error({ gsds: [...gsds], roundedGsds: [...roundedGsds] }, 'TileIndex:InconsistentGSDs:Failed');
        throw new Error(
          `Inconsistent GSDs found: ${[...roundedGsds].join(', ')} ${[...gsds].join(',')}, ${tiffLocationsToLoad.map(protocolAwareString).join(',')}`,
        );
      }
      logger.warn({ gsds: [...gsds], roundedGsds: [...roundedGsds] }, 'TileIndex:InconsistentGSDs:Failed');
    } else if (gsds.size > 1) {
      logger.info({ gsds: [...gsds], roundedGsds: [...roundedGsds] }, 'TileIndex:InconsistentGSDs:RoundedToMatch');
    }
    await fsa.write(fsa.toUrl('/tmp/tile-index-validate/gsd'), String([...roundedGsds][0]));

    const groupByTileNameStartTime = performance.now();

    // Determine gridSize for retiling if not specified or set to 'auto'
    let gridSize = args.scale;
    if (gridSize === 'auto') {
      // Use the common rounded GSD for auto grid size selection
      const roundedGsdStr = [...roundedGsds][0];
      const roundedGsd = Number(roundedGsdStr);
      gridSize = determineGridSizeFromGSDPreset(roundedGsd, args.preset);
      logger.info({ gsd: roundedGsd, preset: args.preset, gridSize }, 'TileIndex:AutoSelectedGridSize');
    }

    const tiffLocations = await extractTiffLocations(tiffs, gridSize, args.sourceEpsg);

    const outputTiles = groupByTileName(tiffLocations);

    logger.info(
      {
        duration: performance.now() - groupByTileNameStartTime,
        files: tiffLocations.length,
        outputs: outputTiles.size,
      },
      'TileIndex: Manifest Assessed for Duplicates',
    );

    if (args.forceOutput || isArgo()) {
      const inputGeoJson = {
        type: 'FeatureCollection',
        features: tiffLocations.map((loc) => {
          const epsg = args.sourceEpsg ?? loc.epsg;
          if (epsg == null) {
            logger.error({ source: protocolAwareString(loc.source) }, 'TileIndex:Epsg:missing');
            return;
          }
          return Projection.get(epsg).boundsToGeoJsonFeature(Bounds.fromBbox(loc.bbox), {
            source: loc.source,
            tileName: loc.tileNames.join(', '),
          });
        }),
      };
      const inputGeoJsonFileName = fsa.toUrl('/tmp/tile-index-validate/input.geojson');
      const outputGeoJsonFileName = fsa.toUrl('/tmp/tile-index-validate/output.geojson');
      const fileListFileName = fsa.toUrl('/tmp/tile-index-validate/file-list.json');
      await fsa.write(inputGeoJsonFileName, JSON.stringify(inputGeoJson));
      logger.info({ path: protocolAwareString(inputGeoJsonFileName) }, 'Write:InputGeoJson');
      const outputGeojson = {
        type: 'FeatureCollection',
        features: [...outputTiles.keys()].map((key) => {
          const mapTileIndex = MapSheet.getMapTileIndex(key);
          if (mapTileIndex == null) throw new Error('Failed to extract tile information from: ' + key);
          return Projection.get(2193).boundsToGeoJsonFeature(Bounds.fromBbox(mapTileIndex.bbox), {
            source: outputTiles.get(key)?.map((l) => l.source),
            tileName: key,
          });
        }),
      };
      await fsa.write(outputGeoJsonFileName, JSON.stringify(outputGeojson));
      logger.info({ path: protocolAwareString(outputGeoJsonFileName) }, 'Write:OutputGeojson');

      const fileList = createFileList(outputTiles, args.includeDerived);
      await fsa.write(fileListFileName, JSON.stringify(fileList));
      logger.info({ path: protocolAwareString(fileListFileName), count: outputTiles.size }, 'Write:FileList');
    }

    let mergeNeeded = false;
    let allValid = true;
    for (const [tileName, tiffs] of outputTiles.entries()) {
      if (tiffs.length === 0) throw new Error(`Output tile with no source tiff: ${tileName}`);
      if (tiffs.length === 1) {
        // For single tiles, validate only if --validate in 'auto' mode
        if (args.validate === 'auto') {
          const tiffLocation = tiffs[0]!;
          const currentValid = validateTiffAlignment(tiffLocation);
          if (!currentValid) {
            logger.error(
              { source: protocolAwareString(tiffLocation.source), tileNames: tiffLocation.tileNames, tiffLocation },
              'TileIndex:Misaligned',
            );
            allValid = false;
          }
        }
        continue;
      }

      // Check if all of the duplicate tiffs have the same scale as the output grid size
      const allHaveSameScaleAsOutput = tiffs.every((tiff) => tiff.scale === gridSize);

      // Determine retiling behavior based on --retile flag
      const shouldRetile = args.retile === true || (args.retile === 'auto' && !allHaveSameScaleAsOutput);

      if (shouldRetile) {
        const bandType = validateConsistentBands(tiffs);
        logger.info(
          { tileName, uris: tiffs.map((v) => protocolAwareString(v.source)), bands: bandType },
          'TileIndex:Retile',
        );
      } else {
        mergeNeeded = true;
        logger.error({ tileName, uris: tiffs.map((v) => protocolAwareString(v.source)) }, 'TileIndex:Duplicate');
      }
    }

    // Validate that all tiffs align to tile grid
    if (args.validate === true) {
      for (const tiffLocation of tiffLocations) {
        const currentValid = validateTiffAlignment(tiffLocation);
        if (!currentValid) {
          logger.error(
            { source: protocolAwareString(tiffLocation.source), tileNames: tiffLocation.tileNames, tiffLocation },
            'TileIndex:Misaligned',
          );
        }
        allValid = allValid && currentValid;
      }
    }

    if (!allValid) throw new Error(`Tile alignment validation failed`);
    if (mergeNeeded) throw new Error(`Duplicate files found, see output.geojson`);
    // TODO do we care if no files are left?

    logger.info({ duration: performance.now() - startTime }, 'TileIndex:Done');
  },
});

/**
 * Validate all tiffs have consistent band information
 * @returns list of bands in the first image if consistent with the other images
 * @throws if one image does not have consistent band information
 */
function validateConsistentBands(locs: TiffLocation[]): string[] {
  const firstBands = locs[0]?.bands ?? [];
  const firstBand = firstBands.join(',');

  for (let i = 1; i < locs.length; i++) {
    const currentBands = locs[i]?.bands.join(',');

    // If the current image doesn't have the same band information gdalbuildvrt will fail
    if (currentBands !== firstBand) {
      // Dump all the imagery and their band types into logs so it can be debugged later
      for (const v of locs) {
        logger.error({ path: protocolAwareString(v.source), bands: v.bands.join(',') }, 'TileIndex:Bands:Heterogenous');
      }

      throw new Error(
        `heterogenous bands: ${currentBands} vs ${firstBand} from: ${locs[0] ? protocolAwareString(locs[0]?.source) : undefined}`,
      );
    }
  }
  return firstBands;
}

export function groupByTileName(tiffs: TiffLocation[]): Map<string, TiffLocation[]> {
  const duplicates: Map<string, TiffLocation[]> = new Map();
  for (const loc of tiffs) {
    for (const sheetCode of loc.tileNames) {
      const uris = duplicates.get(sheetCode) ?? [];
      uris.push(loc);
      duplicates.set(sheetCode, uris);
    }
  }
  return duplicates;
}

export interface TiffLocation {
  /** Location to the image */
  source: URL;
  /** bbox, [minX, minY, maxX, maxY] */
  bbox: BBox;
  /** EPSG code of the tiff if found */
  epsg?: number | null;
  /** Output tile name */
  tileNames: string[];
  /**
   * List of bands inside the tiff in the format `uint8` `uint16`
   *
   * @see {@link extractBandInformation} for more information on bad types
   */
  bands: string[];
  /** Detected grid size/scale of the input tiff based on its dimensions */
  scale?: GridSize;
}

/**
 * Reproject the bounding box if the source and target projections are different.
 * @param bbox input bounding box
 * @param sourceProjection CRS of the input bounding box
 * @param targetProjection target CRS
 */
export function reprojectIfNeeded(bbox: BBox, sourceProjection: Projection, targetProjection: Projection): BBox | null {
  {
    if (targetProjection === sourceProjection) return bbox;
    // fromWgs84 and toWgs84 functions are typed as number[] but could be refined to [number, number] | [number, number, number].
    // With 2 input args, they will return [number, number].
    const [ulX, ulY] = targetProjection.fromWgs84(sourceProjection.toWgs84([bbox[0], bbox[3]])) as [number, number];
    const [lrX, lrY] = targetProjection.fromWgs84(sourceProjection.toWgs84([bbox[2], bbox[1]])) as [number, number];
    return [Math.min(ulX, lrX), Math.min(lrY, ulY), Math.max(ulX, lrX), Math.max(lrY, ulY)];
  }
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
        const sourceBbox = await findBoundingBox(tiff);

        const sourceEpsg = forceSourceEpsg ?? tiff.images[0]?.epsg;
        if (sourceEpsg == null) {
          logger.error(
            { reason: 'EPSG is missing', source: protocolAwareString(tiff.source.url) },
            'MissingEPSG:ExtracTiffLocations:Failed',
          );
          return null;
        }

        const targetProjection = Projection.get(2193);
        const sourceProjection = Projection.get(sourceEpsg);

        const targetBbox = reprojectIfNeeded(sourceBbox, sourceProjection, targetProjection);

        if (targetBbox === null) {
          logger.error(
            { reason: 'Failed to reproject point', source: protocolAwareString(tiff.source.url) },
            'Reprojection:ExtracTiffLocations:Failed',
          );
          return null;
        }

        const covering = getCovering(targetBbox, gridSize);

        // Determine the scale/grid size of this input tiff from its dimensions
        const tiffSize = getSize(targetBbox);
        const detectedScale = determineGridSizeFromDimensions(tiffSize.width, tiffSize.height);

        return {
          bbox: targetBbox,
          source: tiff.source.url,
          tileNames: covering,
          epsg: tiff.images[0]?.epsg,
          bands: await extractBandInformation(tiff),
          scale: detectedScale ?? gridSize, // Use detected scale or fall back to output grid size
        };
      } catch (e) {
        logger.error({ reason: e, source: protocolAwareString(tiff.source.url) }, 'ExtractTiffLocation:Failed');
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

export function getSize(extent: BBox): Size {
  return { width: extent[2] - extent[0], height: extent[3] - extent[1] };
}

export function validateTiffAlignment(tiff: TiffLocation, allowedErrorMetres = 0.015): boolean {
  if (tiff.tileNames.length !== 1) return false;
  const tileName = tiff.tileNames[0];
  if (tileName == null) return false;
  const mapTileIndex = MapSheet.getMapTileIndex(tileName);
  if (mapTileIndex == null) {
    logger.error(
      { reason: `Failed to extract bounding box from: ${tileName}`, source: protocolAwareString(tiff.source) },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }
  // Top Left
  const errX = Math.abs(tiff.bbox[0] - mapTileIndex.bbox[0]);
  const errY = Math.abs(tiff.bbox[3] - mapTileIndex.bbox[3]);
  if (errX > allowedErrorMetres || errY > allowedErrorMetres) {
    logger.error(
      {
        reason: `The origin is invalid x:${tiff.bbox[0]}, y:${tiff.bbox[3]}`,
        source: protocolAwareString(tiff.source),
      },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }

  const tiffSize = getSize(tiff.bbox);
  if (tiffSize.width !== mapTileIndex.width) {
    logger.error(
      {
        reason: `Tiff size is invalid width:${tiffSize.width}, expected:${mapTileIndex.width}`,
        source: protocolAwareString(tiff.source),
      },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }

  if (tiffSize.height !== mapTileIndex.height) {
    logger.error(
      {
        reason: `Tiff size is invalid height:${tiffSize.height}, expected:${mapTileIndex.height}`,
        source: protocolAwareString(tiff.source),
      },
      'TileInvalid:Validation:Failed',
    );
    return false;
  }

  return true;
}

export function getTileName(x: number, y: number, gridSize: GridSize): string {
  const sheetCode = MapSheet.sheetCode(x, y);
  if (!MapSheet.isKnown(sheetCode)) {
    logger.info(
      { sheetCode, x, y, gridSize },
      `Map sheet (${sheetCode}) at coordinates (${x}, ${y}) is outside the known range.`,
    );
  }

  // Shorter tile names for 1:50k
  if (gridSize === MapSheetTileGridSize) return sheetCode;

  const tilesPerMapSheet = Math.floor(MapSheet.gridSizeMax / gridSize);
  const tileWidth = Math.floor(MapSheet.width / tilesPerMapSheet);
  const tileHeight = Math.floor(MapSheet.height / tilesPerMapSheet);

  const nbDigits = gridSize === 500 ? 3 : 2;

  const offsetX = Math.floor((x - MapSheet.origin.x) / MapSheet.width);
  const offsetY = Math.floor((MapSheet.origin.y - y) / MapSheet.height);
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
  if (baseImage === undefined) throw new Error(`Can't get base image for ${protocolAwareString(tiff.source.url)}`);

  const bitsPerSample = await baseImage.fetch(TiffTag.BitsPerSample);
  if (bitsPerSample == null) {
    throw new Error(`Failed to extract band information from ${protocolAwareString(tiff.source.url)}`);
  }

  if (!bitsPerSample.every((currentNumberBits) => currentNumberBits === 8)) {
    throw new Error(`${protocolAwareString(tiff.source.url)} is not a 8 bits TIFF`);
  }
}

/**
 * Get the list of map sheets / tiles that intersect with the given bounding box.
 *
 * @param bbox Bounding box of the area of interest (in EPSG:2193) to get the map sheets for (e.g. TIFF area).
 * @param gridSize Grid size of the map sheets / tiles to get.
 * @param minIntersectionMeters Minimum intersection area in meters (width or height) to include the map sheet.
 */
function getCovering(bbox: BBox, gridSize: GridSize, minIntersectionMeters = 0.15): string[] {
  const SurroundingTiles = [
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
  ];

  const targetBounds = Bounds.fromBbox(bbox);

  const output: string[] = [];
  const tilesPerMapSheetSide = Math.floor(MapSheet.gridSizeMax / gridSize);

  const tileWidth = Math.floor(MapSheet.width / tilesPerMapSheetSide);
  const tileHeight = Math.floor(MapSheet.height / tilesPerMapSheetSide);

  const seen = new Set();
  const todo: Bounds[] = [];

  const sheetName = getTileName(bbox[0], bbox[3], gridSize);
  const sheetInfo = MapSheet.getMapTileIndex(sheetName);
  if (sheetInfo == null) throw new Error('Unable to extract sheet information for point: ' + bbox[0]);

  todo.push(Bounds.fromBbox(sheetInfo.bbox));
  while (todo.length > 0) {
    const nextBounds = todo.shift();
    if (nextBounds == null) continue;

    const nextX = nextBounds.x;
    const nextY = nextBounds.bottom; // inverted Y axis
    const bboxId = `${nextX}:${nextY}:${nextBounds.width}:${nextBounds.height}`;
    // Only process each sheet once
    if (seen.has(bboxId)) continue;
    seen.add(bboxId);

    const intersection = targetBounds.intersection(nextBounds);
    if (intersection == null) continue; // no intersection, target mapshet is outside bounds of source
    // Check all the surrounding tiles
    for (const pt of SurroundingTiles) todo.push(nextBounds.add({ x: pt.x * tileWidth, y: pt.y * tileHeight })); // intersection not null, so add all neighbours
    // Add to output only if the intersection is above the minimum coverage
    if (intersection.width < minIntersectionMeters || intersection.height < minIntersectionMeters) continue;
    output.push(getTileName(nextX, nextY, gridSize));
  }

  return output.sort();
}
