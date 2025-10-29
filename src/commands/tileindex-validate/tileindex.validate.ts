import { Bounds, Projection } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import type { Size } from '@cogeotiff/core';
import { Tiff, TiffTag } from '@cogeotiff/core';
import type { BBox } from '@linzjs/geojson';
import type { Type } from 'cmd-ts';
import { boolean, command, flag, number, option, optional, restPositionals, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { isArgo } from '../../utils/argo.ts';
import { extractBandInformation } from '../../utils/band.ts';
import type { FileFilter } from '../../utils/chunk.ts';
import { asyncFilter } from '../../utils/chunk.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { createFileList, protocolAwareString } from '../../utils/filelist.ts';
import { findBoundingBox } from '../../utils/geotiff.ts';
import type { GridSize } from '../../utils/mapsheet.ts';
import { GridSizes, MapSheet, MapSheetTileGridSize } from '../../utils/mapsheet.ts';
import type { CommandArguments } from '../../utils/type.util.ts';
import { config, forceOutput, registerCli, UrlFolderList, verbose } from '../common.ts';
import { CommandListArgs } from '../list/list.ts';

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
}

interface TiffsMetadata {
  projections: Set<number>;
  gsds: Set<number>;
  roundedGsds: Set<string>;
  canGetResolution: boolean;
  tiffCount: number;
}

export type CommandTileIndexValidateArgs = CommandArguments<typeof commandTileIndexValidate>;

export const GridSizeFromString: Type<string, GridSize | 'auto'> = {
  /**
   * Convert an input string to a GridSize or return 'auto' if 'auto' is the input value.
   * @param value The input string.
   * @returns The corresponding GridSize or 'auto'.
   */
  async from(value) {
    if (value === 'auto') return value;
    const gridSize = Number(value) as GridSize;
    if (!GridSizes.includes(gridSize)) {
      throw new Error(`Invalid grid size "${value}"; valid values: "${GridSizes.join('", "')}", or "auto"`);
    }
    return gridSize;
  },
};

export const commandTileIndexValidate = command({
  name: 'tileindex-validate',
  description: 'Map input files to their output tile and optionally validate them.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    include: CommandListArgs.include,
    scale: option({
      type: GridSizeFromString,
      long: 'scale',
      description:
        'Tile grid scale to align output tile to. If set to "auto ", the system will determine the appropriate scale based on the imagery type (`--preset`) and its GSD',
      defaultValue: (): 'auto' => 'auto',
    }),
    sourceEpsg: option({ type: optional(number), long: 'source-epsg', description: 'Force epsg code for input tiffs' }),
    validate: flag({
      type: boolean,
      long: 'validate',
      description: 'Validate input TIFFs align to grid and only one input TIFF per output tile',
      defaultValueIsSerializable: true,
      defaultValue: () => false,
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
    location: restPositionals({
      type: UrlFolderList,
      displayName: 'location',
      description: 'Location of the source files. Accepts multiple source paths.',
    }),
    concurrency: option({
      type: number,
      long: 'concurrency',
      description: 'Number of TIFF files to read concurrently',
      defaultValue: () => 25,
    }),
  },
  /**
   * Validate list of tiffs match a LINZ map sheet tile index
   *
   * If --validate
   * Asserts that there will be no duplicates
   * Validates all inputs align to output grid
   *
   *
   * Examples:
   * input: 1:1000
   * scale: 1:1000
   * --validate=true
   * Validate the top left points of every input align to the 1:1000 grid and no duplicates
   *
   *
   * input: 1:1000
   * scale: 1:5000, 1:10_000
   * --retile=true --validate=false
   * create a re-tiling output of {tileName, input: string[] }
   *
   * -- Not handled (yet!)
   * input: 1:10_000
   * scale: 1:1000
   * create a re-tiling output of  1 input tiff = 100x {tileName, input: string}[]
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
   * Create a list of files that need to be retiled
   * ```bash
   * tileindex-validate --scale 5000 ./path/to/imagery/
   * ```
   */
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('TileIndex:Start');

    const readTiffStartTime = performance.now();
    const { tiffs, locations } = await loadTiffs(args);
    await validatePreset(args.preset, tiffs);
    const tiffsMetadata = await getTiffsMetadata(tiffs, locations);
    const readDuration = performance.now() - readTiffStartTime;
    logger.info(
      {
        tiffCount: tiffs.length,
        projections: [...tiffsMetadata.projections],
        gsds: [...tiffsMetadata.gsds],
        duration: readDuration,
      },
      'TileIndex: All Files Read',
    );

    const groupByTileNameStartTime = performance.now();
    let gridSize = args.scale;
    if (gridSize === 'auto') {
      const roundedGsd = Number([...tiffsMetadata.roundedGsds][0]);
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
      await generateOutputFiles(
        tiffLocations,
        outputTiles,
        args.sourceEpsg,
        args.includeDerived,
        String([...tiffsMetadata.roundedGsds][0]),
      );
    }

    validateTiling(outputTiles, tiffLocations, args.validate);

    logger.info({ duration: performance.now() - startTime }, 'TileIndex:Done');
  },
});

export const TiffLoader = {
  /**
   * Concurrently load a collection of tiffs in the locations provided.
   *
   * @param locations list of locations to find tiffs in.
   * @param args filter the tiffs
   * @returns Initialized tiff
   */
  async load(locations: URL[], q: ConcurrentQueue, args?: FileFilter): Promise<Tiff[]> {
    const filterArgs = { ...args, sizeMin: 0 };
    const hosts = new Set<string>();

    const totalTime = performance.now();
    let progressTime = totalTime;

    /** Number of tiff files processed */
    let tiffLoaded = 0;
    /** Number of tiffs that filed to load */
    let failedCount = 0;
    const output: Tiff[] = [];
    let lastError: unknown = null;

    for (const loc of locations) {
      for await (const file of asyncFilter(fsa.details(loc), filterArgs)) {
        if (!isTiff(file.url)) continue;
        // ensure credentials have been loaded
        if (!hosts.has(file.url.hostname)) {
          await fsa.head(file.url);
          hosts.add(file.url.hostname);
        }

        q.push(() => {
          return Tiff.create(fsa.source(file.url))
            .then((tiff) => {
              tiffLoaded++;
              if (tiffLoaded % 1_000 === 0) {
                logger.info(
                  {
                    source: protocolAwareString(file.url),
                    tiffLoaded,
                    duration: performance.now() - progressTime,
                  },
                  'Tiff:Load:Progress',
                );
                progressTime = performance.now();
              }
              output.push(tiff);
            })
            .catch((e: unknown) => {
              logger.fatal({ lastFile: protocolAwareString(file.url), err: e }, 'Tiff:Load:Failed');
              failedCount++;
              tiffLoaded++;
              lastError = e;
            });
        });

        if (q.todo.size > 2_500) await q.join();
      }
    }

    await q.join();

    if (failedCount > 0) {
      logger.fatal({ failedCount }, 'Tiff:Load:Failed');
      throw Error('Tiff loading failed: ' + String(lastError));
    }

    if (output.length === 0) throw new Error('No Files found');

    logger.info({ count: output.length, duration: performance.now() - totalTime }, 'Tiffs:Loaded');
    return output;
  },
};

/**
 * Load TIFF files from the specified locations.
 *
 * @param args The command arguments containing location and concurrency settings.
 * @returns A promise that resolves to an object containing the loaded TIFFs and their locations.
 */
async function loadTiffs(args: CommandTileIndexValidateArgs): Promise<{ tiffs: Tiff[]; locations: URL[] }> {
  const q = new ConcurrentQueue(args.concurrency);
  const tiffLocationsToLoad = args.location.flat();
  const tiffs = await TiffLoader.load(tiffLocationsToLoad, q, args);
  return { tiffs, locations: tiffLocationsToLoad };
}

/**
 * Get metadata from the list of tiffs
 *
 * @param tiffs
 * @param locations
 * @returns TiffsMetadata
 */
async function getTiffsMetadata(tiffs: Tiff[], locations: URL[]): Promise<TiffsMetadata> {
  const projections = new Set<number>();
  const gsds = new Set<number>();
  const roundedGsds = new Set<string>();
  let canGetResolution = true;

  tiffs.forEach((t) => {
    const image = t.images[0];
    if (image) {
      if (image.epsg != null) projections.add(image.epsg);
      try {
        gsds.add(image.resolution[0]);
        roundedGsds.add((Math.round(image.resolution[0] * 200) / 200).toString()); // Round to nearest 0.005
      } catch (e) {
        canGetResolution = false;
        logger.error({ source: protocolAwareString(t.source.url), err: e }, 'TileIndex:GetResolution:Failed');
      }
    }
  });

  if (!canGetResolution) throw new Error('Failed to get resolution of all TIFFs');

  if (projections.size > 1) {
    logger.warn({ projections: [...projections] }, 'TileIndex:InconsistentProjections');
  }
  if (roundedGsds.size > 1) {
    logger.error({ gsds: [...gsds], roundedGsds: [...roundedGsds] }, 'TileIndex:InconsistentGSDs:Failed');
    throw new Error(
      `Inconsistent GSDs found: ${[...roundedGsds].join(', ')} ${[...gsds].join(',')}, ${locations.map(protocolAwareString).join(',')}`,
    );
  } else if (gsds.size > 1) {
    logger.info({ gsds: [...gsds], roundedGsds: [...roundedGsds] }, 'TileIndex:InconsistentGSDs:RoundedToMatch');
  }

  return {
    projections,
    gsds,
    roundedGsds,
    canGetResolution,
    tiffCount: tiffs.length,
  };
}

/**
 * Generate output files as result of the tile index validation
 *
 * @param tiffLocations The list of source TIFF locations.
 * @param outputTiles The map of output tiles to their source TIFFs.
 * @param sourceEpsg The EPSG code of the source TIFFs.
 * @param includeDerived Whether to include derived TIFFs in the output.
 * @param gsd The ground sample distance to use for the output.
 */
async function generateOutputFiles(
  tiffLocations: TiffLocation[],
  outputTiles: Map<string, TiffLocation[]>,
  sourceEpsg: number | undefined,
  includeDerived: boolean,
  gsd: string,
): Promise<void> {
  const inputGeoJson = {
    type: 'FeatureCollection',
    features: tiffLocations.map((loc) => {
      const epsg = sourceEpsg ?? loc.epsg;
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

  const inputGeoJsonFileName = fsa.toUrl('/tmp/tile-index-validate/input.geojson');
  const outputGeoJsonFileName = fsa.toUrl('/tmp/tile-index-validate/output.geojson');
  const fileListFileName = fsa.toUrl('/tmp/tile-index-validate/file-list.json');
  const gsdFileName = fsa.toUrl('/tmp/tile-index-validate/gsd');

  await fsa.write(inputGeoJsonFileName, JSON.stringify(inputGeoJson));
  logger.info({ path: protocolAwareString(inputGeoJsonFileName) }, 'Write:InputGeoJson');

  await fsa.write(outputGeoJsonFileName, JSON.stringify(outputGeojson));
  logger.info({ path: protocolAwareString(outputGeoJsonFileName) }, 'Write:OutputGeojson');

  const fileList = createFileList(outputTiles, includeDerived);
  await fsa.write(fileListFileName, JSON.stringify(fileList));
  logger.info({ path: protocolAwareString(fileListFileName), count: outputTiles.size }, 'Write:FileList');

  await fsa.write(gsdFileName, gsd);
  logger.info({ path: protocolAwareString(gsdFileName), gsd }, 'Write:GSD');
}

/**
 * Validate the tiling of the output tiles against the input TIFFs.
 *
 * @param outputTiles Map of output tiles to their source TIFFs.
 * @param tiffLocations List of source TIFFs.
 * @param validate Whether to validate the alignment of source TIFFs and if there are duplicates.
 */
function validateTiling(
  outputTiles: Map<string, TiffLocation[]>,
  tiffLocations: TiffLocation[],
  validate: boolean,
): void {
  let retileNeeded = false;

  for (const [tileName, tiffs] of outputTiles.entries()) {
    if (tiffs.length === 0) throw new Error(`Output tile with no source tiff: ${tileName}`);
    if (tiffs.length === 1) continue;
    if (!validate) {
      const bandType = validateConsistentBands(tiffs);
      logger.info(
        { tileName, uris: tiffs.map((v) => protocolAwareString(v.source)), bands: bandType },
        'TileIndex:Retile',
      );
    } else {
      retileNeeded = true;
      logger.error({ tileName, uris: tiffs.map((v) => protocolAwareString(v.source)) }, 'TileIndex:Duplicate');
    }
  }

  if (validate) {
    let allValid = true;
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
    if (!allValid) {
      throw new Error(`Tile alignment validation failed`);
    }
  }

  if (retileNeeded) throw new Error(`Duplicate files found, see output.geojson`);
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
 * Validate all tiffs have consistent band information
 *
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

/**
 * Group input TIFFs by their output tile names.
 *
 * @param tiffs List of input TIFFs to group.
 * @returns Map of tile names to their corresponding input TIFFs.
 */
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

        return {
          bbox: targetBbox,
          source: tiff.source.url,
          tileNames: covering,
          epsg: tiff.images[0]?.epsg,
          bands: await extractBandInformation(tiff),
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

/**
 * Get a tile size from its bounding box.
 *
 * @param extent The bounding box coordinates.
 * @returns The width and height of the bounding box.
 */
export function getSize(extent: BBox): Size {
  return { width: extent[2] - extent[0], height: extent[3] - extent[1] };
}

/**
 * Check if a URL points to a TIFF file.
 *
 * @param url The URL to check.
 * @returns True if the URL points to a TIFF file, false otherwise.
 */
export function isTiff(url: URL): boolean {
  const fileName = url.pathname.toLowerCase();
  return fileName.endsWith('.tiff') || fileName.endsWith('.tif');
}

/**
 * Validate the alignment of a TIFF against its expected output tile.
 *
 * @param tiff The TIFF to validate.
 * @param allowedErrorMetres The allowed error in metres for the alignment.
 * @returns True if the TIFF is correctly aligned, false otherwise.
 */
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

/**
 * Get the tile name for a given position and grid size.
 *
 * @param x The x coordinate of the tile.
 * @param y The y coordinate of the tile.
 * @param gridSize The grid size of the tile.
 * @returns The tile name.
 */
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
