import { Bounds, EpsgCode, Projection } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import type { Size } from '@cogeotiff/core';
import { Tiff } from '@cogeotiff/core';
import type { BBox } from '@linzjs/geojson';
import type { Type } from 'cmd-ts';
import { boolean, command, flag, number, oneOf, option, optional, restPositionals, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { isArgo } from '../../utils/argo.ts';
import { extractBandInformation } from '../../utils/band.ts';
import type { FileFilter } from '../../utils/chunk.ts';
import { asyncFilter } from '../../utils/chunk.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { createFileList, protocolAwareString } from '../../utils/filelist.ts';
import { findBoundingBox, findResolution } from '../../utils/geotiff.ts';
import type { LasHeader } from '../../utils/las.ts';
import { isPointCloud, readLasHeader } from '../../utils/las.ts';
import type { GridSize, MapSheetLike } from '../../utils/mapsheet.ts';
import { getMapSheet, GridSizes, MapSheet, MapSheetRegistry } from '../../utils/mapsheet.ts';
import type { CommandArguments } from '../../utils/type.util.ts';
import { config, forceOutput, registerCli, UrlFolderList, verbose } from '../common.ts';
import { CommandListArgs } from '../list/list.ts';

export interface SourceLocation {
  /** Location to the source file */
  source: URL;
  /** bbox, [minX, minY, maxX, maxY] */
  bbox: BBox;
  /** EPSG code of the file if found */
  epsg?: number | null;
  /** Output tile name */
  tileNames: string[];
  /**
   * List of bands inside a TIFF in the format `uint8',`uint16`, `uint32`, or the point format and scale of a point cloud
   *
   * @see {@link extractBandInformation} for more information on bad types
   */
  bands: string[];
}

interface TiffsMetadata {
  /** Set of unique EPSG codes found in the TIFF files */
  projections: Set<number>;
  /** Set of unique GSDs found in the TIFF files */
  gsds: Set<number>;
  /** Set of unique rounded GSDs found in the TIFF files */
  roundedGsds: Set<string>;
  /** Whether the resolution could be determined for all TIFFs */
  canGetResolution: boolean;
  /** Number of TIFF files processed */
  tiffCount: number;
  /** Set of unique data types found in the TIFF files */
  dataTypes: Set<string>;
}

export type CommandTileIndexValidateArgs = CommandArguments<typeof commandTileIndexValidate>;

export const GridSizeFromString: Type<string, GridSize | 'auto'> = {
  /**
   * Convert an input string to a GridSize or return 'auto' if 'auto' is the input value.
   *
   * @param value The input string.
   * @returns The corresponding GridSize or 'auto'.
   */
  // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
  async from(value) {
    if (value === 'auto') return value;
    const gridSize = Number(value) as GridSize;
    if (!GridSizes.includes(gridSize)) {
      throw new Error(`Invalid grid size "${value}"; valid values: "${GridSizes.join('", "')}", or "auto"`);
    }
    return gridSize;
  },
};

export const TargetEpsgFromString: Type<string, number> = {
  /**
   * Convert an input string to one of the supported target EPSG codes.
   *
   * @param value The input string.
   * @returns The corresponding EPSG code.
   */
  // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
  async from(value) {
    const epsg = Number(value);
    if (MapSheetRegistry[epsg] == null) {
      throw new Error(`Invalid target-epsg "${value}". valid values: "${Object.keys(MapSheetRegistry).join('", "')}"`);
    }
    return epsg;
  },
};

export const SourceTypes = ['auto', 'raster', 'pointcloud'] as const;
export type SourceType = (typeof SourceTypes)[number];

export const commandTileIndexValidate = command({
  name: 'tileindex-validate',
  description:
    'Map input TIFF or point cloud (LAS/LAZ) files to output tiles based on their location. Validate TIFF alignment to the tile grid and output retiling information.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    include: CommandListArgs.include,
    scale: option({
      type: GridSizeFromString,
      long: 'scale',
      description:
        'Tile grid scale to align output tile to. If set to "auto", the system will determine the appropriate scale based on the imagery type (`--preset`) and its GSD. Required for point clouds',
      defaultValue: (): 'auto' => 'auto',
    }),
    sourceType: option({
      type: oneOf(SourceTypes),
      long: 'source-type',
      description:
        'Type of the input files. "auto" detects it and fails if there are both TIFFs and point clouds. Point clouds are placed in the tile of their centroid',
      defaultValueIsSerializable: true,
      defaultValue: (): SourceType => 'auto',
    }),
    sourceEpsg: option({ type: optional(number), long: 'source-epsg', description: 'Force epsg code for input files' }),
    targetEpsg: option({
      type: optional(TargetEpsgFromString),
      long: 'target-epsg',
      description:
        'Target CRS to align output tiles to and calculate map sheet names in. ' +
        'Defaults to the (source) EPSG of the input tiffs; set to ' +
        `${Object.entries(MapSheetRegistry)
          .map(([epsg, mapSheet]) => `${epsg} (${mapSheet.name})`)
          .join(' or ')} to reproject into a specific grid.`,
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
      description:
        'Location of the source files. Accepts multiple source paths. Later locations take priority where folders overlap.',
    }),
    concurrency: option({
      type: number,
      long: 'concurrency',
      description: 'Number of files to read concurrently',
      defaultValue: () => 25,
    }),
  },
  /**
   * Validate list of tiffs match a LINZ map sheet tile index
   * Group the input TIFFs to their output tile names
   *
   * Examples:
   * input: 1:1000
   * scale: 1:1000
   * Create a 1:1 mapping of {tileName, input: string}
   *
   *
   * input: 1:1000
   * scale: 1:5000, 1:10_000
   * Create a re-tiling output of {tileName, input: string[] }
   *
   * -- Not handled (yet!)
   * input: 1:10_000
   * scale: 1:1000
   * Create a re-tiling output of  1 input tiff = 100x {tileName, input: string}[]
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
   * Create a list of files that need to be retiled
   * ```bash
   * tileindex-validate --scale=auto --preset=webp ./path/to/imagery/
   * ```
   */
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('TileIndex:Start');

    const sourceType =
      args.sourceType === 'auto' ? await detectSourceType(args.location.flat(), args) : args.sourceType;
    logger.info({ sourceType }, 'TileIndex:SourceType');
    const input = sourceType === 'pointcloud' ? await loadPointClouds(args) : await loadRaster(args);

    const groupByTileNameStartTime = performance.now();
    const locations = await extractLocations(input.files, input.gridSize, args.sourceEpsg, input.targetEpsg);
    const outputTiles = groupByTileName(locations);
    logger.info(
      {
        duration: performance.now() - groupByTileNameStartTime,
        files: locations.length,
        outputs: outputTiles.size,
      },
      'TileIndex:InputFilesGroupByTileName',
    );

    if (args.forceOutput || isArgo()) {
      await generateOutputFiles(
        locations,
        outputTiles,
        input.targetEpsg,
        args.includeDerived,
        input.gsd,
        input.dataType,
        input.crs,
      );
    }

    validateTiling(outputTiles);

    logger.info({ duration: performance.now() - startTime }, 'TileIndex:Done');
  },
});

export interface FileType<T extends { source: URL }> {
  /** Name in logs and errors, eg "Tiff" */
  name: string;
  accept(url: URL): boolean;
  open(url: URL): Promise<T>;
}

export const TiffFiles: FileType<TiffSource> = {
  name: 'Tiff',
  accept: isTiff,
  open: async (url) => new TiffSource(await Tiff.create(fsa.source(url))),
};

export const PointCloudFiles: FileType<PointCloudSource> = {
  name: 'PointCloud',
  accept: isPointCloud,
  open: async (url) => new PointCloudSource(await readLasHeader(url)),
};

export const FileLoader = {
  /**
   * Concurrently load the files of a type in the locations provided.
   *
   * Files are ordered by location, then listing. A file listed by overlapping locations is loaded once and belongs to the most specific one.
   *
   * @param type file type to load
   * @param locations list of locations to find files in.
   * @param args filter the files
   * @returns loaded files
   */
  async load<T extends { source: URL }>(
    type: FileType<T>,
    locations: URL[],
    q: ConcurrentQueue,
    args?: FileFilter,
  ): Promise<T[]> {
    const filterArgs = { ...args, sizeMin: 0 };
    const hosts = new Set<string>();
    /** File href to its listing position and most specific location's href length */
    const listingOrder = new Map<string, { position: number; specificity: number }>();

    const totalTime = performance.now();
    let progressTime = totalTime;

    let loaded = 0;
    let listed = 0;
    let failedCount = 0;
    const output: T[] = [];
    let lastError: unknown = null;

    for (const loc of locations) {
      for await (const file of asyncFilter(fsa.details(loc), filterArgs)) {
        if (!type.accept(file.url)) continue;
        const existing = listingOrder.get(file.url.href);
        // Deepest location wins, the later one on ties
        if (existing == null || loc.href.length >= existing.specificity) {
          listingOrder.set(file.url.href, { position: listed, specificity: loc.href.length });
        }
        listed++;
        if (existing != null) continue;
        // ensure credentials have been loaded
        if (!hosts.has(file.url.hostname)) {
          await fsa.head(file.url);
          hosts.add(file.url.hostname);
        }

        q.push(() => {
          return type
            .open(file.url)
            .then((item) => {
              loaded++;
              if (loaded % 1_000 === 0) {
                logger.info(
                  {
                    source: protocolAwareString(file.url),
                    loaded,
                    duration: performance.now() - progressTime,
                  },
                  `${type.name}:Load:Progress`,
                );
                progressTime = performance.now();
              }
              output.push(item);
            })
            .catch((e: unknown) => {
              logger.fatal({ lastFile: protocolAwareString(file.url), err: e }, `${type.name}:Load:Failed`);
              failedCount++;
              loaded++;
              lastError = e;
            });
        });

        if (q.todo.size > 2_500) await q.join();
      }
    }

    const duplicates = listed - listingOrder.size;
    if (duplicates > 0) logger.warn({ duplicates }, `${type.name}:Load:Duplicates`);

    await q.join();

    if (failedCount > 0) {
      logger.fatal({ failedCount }, `${type.name}:Load:Failed`);
      throw Error(`${type.name} loading failed: ` + String(lastError));
    }

    if (output.length === 0) throw new Error('No Files found');

    // Restore listing order, as files load concurrently
    output.sort((a, b) => {
      const orderA = listingOrder.get(a.source.href);
      const orderB = listingOrder.get(b.source.href);
      if (orderA == null || orderB == null) throw new Error(`${type.name} missing from listing`);
      return orderA.position - orderB.position;
    });

    logger.info({ count: output.length, duration: performance.now() - totalTime }, `${type.name}s:Loaded`);
    return output;
  },
};

interface TileIndexInput {
  files: SourceFile[];
  gridSize: GridSize;
  targetEpsg: number;
  gsd: string;
  dataType: string;
  /** CRS of the output tiles, eg "EPSG:2193+7839" */
  crs: string;
}

/** Load and validate the input TIFFs */
async function loadRaster(args: CommandTileIndexValidateArgs): Promise<TileIndexInput> {
  const readTiffStartTime = performance.now();
  const locations = args.location.flat();
  const files = await FileLoader.load(TiffFiles, locations, new ConcurrentQueue(args.concurrency), args);
  const tiffs = files.map((file) => file.tiff);
  await validatePreset(args.preset, tiffs);
  const tiffsMetadata = await getTiffsMetadata(tiffs, locations);
  logger.info(
    {
      tiffCount: tiffs.length,
      projections: [...tiffsMetadata.projections],
      gsds: [...tiffsMetadata.gsds],
      duration: performance.now() - readTiffStartTime,
    },
    'TileIndex:InputFilesRead',
  );

  let gridSize = args.scale;
  if (gridSize === 'auto') {
    const roundedGsd = Number([...tiffsMetadata.roundedGsds][0]);
    gridSize = determineGridSizeFromGSDPreset(roundedGsd, args.preset);
    logger.info({ gsd: roundedGsd, preset: args.preset, gridSize }, 'TileIndex:AutoSelectedGridSize');
  }

  // Default to the (source) EPSG of the input tiffs so imagery tiles against its own native
  // map sheet grid (eg Chatham Islands EPSG:3793) unless the caller explicitly asks to reproject.
  const targetEpsg = args.targetEpsg ?? args.sourceEpsg ?? [...tiffsMetadata.projections][0] ?? EpsgCode.Nztm2000;

  return {
    files,
    gridSize,
    targetEpsg,
    gsd: String([...tiffsMetadata.roundedGsds][0]),
    dataType: String([...tiffsMetadata.dataTypes][0]),
    crs: `EPSG:${targetEpsg}`,
  };
}

/** Load the headers of the input point clouds */
async function loadPointClouds(args: CommandTileIndexValidateArgs): Promise<TileIndexInput> {
  if (args.scale === 'auto') throw new Error('Point clouds need a --scale');
  const files = await FileLoader.load(
    PointCloudFiles,
    args.location.flat(),
    new ConcurrentQueue(args.concurrency),
    args,
  );
  const crs = validatePointCloudCrs(files, args.sourceEpsg);
  const pointFormat = validatePointFormat(files);
  return {
    files,
    gridSize: args.scale,
    targetEpsg: args.targetEpsg ?? args.sourceEpsg ?? files[0]?.epsg ?? EpsgCode.Nztm2000,
    // Point density (points/m²) and point format, until they get their own outputs
    gsd: String(medianDensity(files)),
    dataType: String(pointFormat),
    crs,
  };
}

/** Most common value, and the items with another value */
function majority<T>(items: T[], value: (item: T) => string): { common?: string; others: T[] } {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(value(item), (counts.get(value(item)) ?? 0) + 1);
  const common = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { common, others: items.filter((item) => value(item) !== common) };
}

/**
 * Fail on point clouds without one shared horizontal + vertical CRS, listing every bad file
 *
 * @returns the shared CRS, eg "EPSG:2193+7839"
 */
function validatePointCloudCrs(files: PointCloudSource[], forceSourceEpsg?: number): string {
  const crs = (f: PointCloudSource): string => `EPSG:${forceSourceEpsg ?? f.epsg}+${f.header.verticalEpsg}`;
  const problems = new Map<PointCloudSource, string>();
  for (const f of files) {
    const { epsg, verticalEpsg, verticalDatum } = f.header;
    if (forceSourceEpsg == null && epsg == null) problems.set(f, 'no horizontal CRS');
    else if (verticalEpsg == null) problems.set(f, 'no vertical CRS');
    else if (verticalDatum === verticalEpsg) problems.set(f, `vertical datum is the CRS code ${verticalDatum}`);
  }
  const { common, others } = majority(
    files.filter((f) => !problems.has(f)),
    crs,
  );
  for (const f of others) problems.set(f, `${crs(f)}, most files are ${common}`);
  if (common == null || problems.size > 0) {
    throw new Error(
      'Point cloud CRS check failed, run fix-laz-header on these files (mainland NZTM2000 + NZVD2016 data only, until it takes a CRS parameter):\n' +
        [...problems].map(([f, reason]) => `${protocolAwareString(f.source)}: ${reason}`).join('\n'),
    );
  }
  return common;
}

/** Fail on mixed point formats, listing every file that differs from the most common one */
function validatePointFormat(files: PointCloudSource[]): number {
  const { common, others } = majority(files, (f) => String(f.header.pointFormat));
  if (common == null || others.length > 0) {
    throw new Error(
      `Mixed point formats, most files are ${common}:\n` +
        others.map((f) => `${protocolAwareString(f.source)}: ${f.header.pointFormat}`).join('\n'),
    );
  }
  return Number(common);
}

/** Median points per m² of the header bboxes, rough as they include buffers and empty areas */
function medianDensity(files: PointCloudSource[]): number {
  const densities = files
    .map((f) => {
      const { width, height } = getSize(f.header.bbox);
      return f.header.pointCount / (width * height);
    })
    .filter((d) => Number.isFinite(d))
    .sort((a, b) => a - b);
  return Number((densities[Math.floor(densities.length / 2)] ?? 0).toPrecision(3));
}

/** "pointcloud" if only point clouds are listed, "raster" otherwise. Fails if both TIFFs and point clouds are listed */
export async function detectSourceType(locations: URL[], args?: FileFilter): Promise<Exclude<SourceType, 'auto'>> {
  const found = new Set<Exclude<SourceType, 'auto'>>();
  for (const loc of locations) {
    for await (const file of asyncFilter(fsa.details(loc), args)) {
      if (isTiff(file.url)) found.add('raster');
      if (isPointCloud(file.url)) found.add('pointcloud');
      if (found.size > 1) throw new Error('Found both TIFFs and point clouds, set --source-type or --include');
    }
  }
  return found.has('pointcloud') ? 'pointcloud' : 'raster';
}

/**
 * Get metadata from the list of TIFFs
 *
 * @param tiffs
 * @param locations
 * @returns TiffsMetadata
 */
async function getTiffsMetadata(tiffs: Tiff[], locations: URL[]): Promise<TiffsMetadata> {
  const projections = new Set<number>();
  const gsds = new Set<number>();
  const roundedGsds = new Set<string>();
  const dataTypes = new Set<string>();
  const failedDataTypeSources: string[] = [];
  let canGetResolution = true;

  await Promise.all(
    tiffs.map(async (tiff): Promise<void> => {
      try {
        const image = tiff.images[0];
        if (image) {
          if (image.epsg != null) projections.add(image.epsg);

          const bands = await extractBandInformation(tiff).catch((e: unknown) => {
            logger.error(
              { source: protocolAwareString(tiff.source.url), err: e },
              'TileIndex:ExtractBandInformation:Failed',
            );
            failedDataTypeSources.push(protocolAwareString(tiff.source.url));
            return null;
          });
          if (bands != null && bands[0] != null) {
            dataTypes.add(bands[0]);
          }
        }
        const gsd = await findResolution(tiff);
        gsds.add(gsd);
        roundedGsds.add((Math.round(gsd * 200) / 200).toString()); // Round to nearest 0.005
      } catch (e) {
        canGetResolution = false;
        logger.error({ source: protocolAwareString(tiff.source.url), err: e }, 'TileIndex:GetResolution:Failed');
      }
    }),
  );

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

  if (dataTypes.size === 0) {
    logger.error({ sources: failedDataTypeSources }, 'TileIndex:NoDataTypesFound');
    throw new Error(`No data types found in the TIFFs: ${failedDataTypeSources.join(', ')}`);
  }

  if (dataTypes.size > 1) {
    logger.error({ dataTypes: [...dataTypes] }, 'TileIndex:InconsistentDataTypes:Failed');
    throw new Error(`Inconsistent data types found: ${[...dataTypes].join(', ')}`);
  }

  return {
    projections,
    gsds,
    roundedGsds,
    canGetResolution,
    tiffCount: tiffs.length,
    dataTypes,
  };
}

/**
 * Generate output files as result of the tile index validation
 *
 * @param locations The list of source file locations.
 * @param outputTiles The map of output tiles to their source files.
 * @param targetEpsg The EPSG code the tiles were aligned to (see `getMapTileIndex`/`extractLocations`).
 * @param includeDerived Whether to include derived TIFFs in the output.
 * @param gsd The ground sample distance to use for the output.
 * @param crs The CRS of the output tiles.
 */
async function generateOutputFiles(
  locations: SourceLocation[],
  outputTiles: Map<string, SourceLocation[]>,
  targetEpsg: number,
  includeDerived: boolean,
  gsd: string,
  dataType: string,
  crs: string,
): Promise<void> {
  const mapSheet = getMapSheet(targetEpsg);
  const targetProjection = Projection.get(targetEpsg);

  const inputGeoJson = {
    type: 'FeatureCollection',
    // `loc.bbox` has already been reprojected into `targetEpsg` by `extractLocations`, so it
    // must be read back out with the same projection, not the file's original source EPSG.
    features: locations.map((loc) => {
      return targetProjection.boundsToGeoJsonFeature(Bounds.fromBbox(loc.bbox), {
        source: loc.source,
        tileName: loc.tileNames.join(', '),
      });
    }),
  };

  const outputGeojson = {
    type: 'FeatureCollection',
    features: [...outputTiles.keys()].map((key) => {
      const mapTileIndex = mapSheet.getMapTileIndex(key);
      if (mapTileIndex == null) throw new Error('Failed to extract tile information from: ' + key);
      return targetProjection.boundsToGeoJsonFeature(Bounds.fromBbox(mapTileIndex.bbox), {
        source: outputTiles.get(key)?.map((l) => l.source),
        tileName: key,
      });
    }),
  };

  const inputGeoJsonFileName = fsa.toUrl('/tmp/tile-index-validate/input.geojson');
  const outputGeoJsonFileName = fsa.toUrl('/tmp/tile-index-validate/output.geojson');
  const fileListFileName = fsa.toUrl('/tmp/tile-index-validate/file-list.json');
  const gsdFileName = fsa.toUrl('/tmp/tile-index-validate/gsd');
  const dataTypeFileName = fsa.toUrl('/tmp/tile-index-validate/data-type');
  const crsFileName = fsa.toUrl('/tmp/tile-index-validate/crs');

  await fsa.write(inputGeoJsonFileName, JSON.stringify(inputGeoJson));
  logger.info({ path: protocolAwareString(inputGeoJsonFileName) }, 'Write:InputGeoJson');

  await fsa.write(outputGeoJsonFileName, JSON.stringify(outputGeojson));
  logger.info({ path: protocolAwareString(outputGeoJsonFileName) }, 'Write:OutputGeojson');

  const fileList = createFileList(outputTiles, includeDerived);
  await fsa.write(fileListFileName, JSON.stringify(fileList));
  logger.info({ path: protocolAwareString(fileListFileName), count: outputTiles.size }, 'Write:FileList');

  await fsa.write(gsdFileName, gsd);
  logger.info({ path: protocolAwareString(gsdFileName), gsd }, 'Write:GSD');

  await fsa.write(dataTypeFileName, dataType);
  logger.info({ path: protocolAwareString(dataTypeFileName), dataType }, 'Write:DataType');

  await fsa.write(crsFileName, crs);
  logger.info({ path: protocolAwareString(crsFileName), crs }, 'Write:Crs');
}

/**
 * Validate the tiling of the output tiles against the input files.
 *
 * @param outputTiles Map of output tiles to their source files.
 */
function validateTiling(outputTiles: Map<string, SourceLocation[]>): void {
  for (const [tileName, files] of outputTiles.entries()) {
    if (files.length === 0) throw new Error(`Output tile with no source file: ${tileName}`);
    if (files.length === 1) continue;
    const bandType = validateConsistentBands(files);
    logger.info(
      { tileName, uris: files.map((v) => protocolAwareString(v.source)), bands: bandType },
      'TileIndex:Retile',
    );
  }
}

/**
 * Determine the grid size from the GSD and preset (datatype)
 *
 * @param gsd Ground Sample Distance in meters
 * @param preset 'webp' for aerial imagery, 'rgbnir_zstd' for near-infrared aerial imagery, 'dem_lerc' for DEM/DSM/Hillshade
 */
export function determineGridSizeFromGSDPreset(gsd: number, preset: string): GridSize {
  // Near-Infrared Aerial Imagery, Ancillary Aerial Imagery and Ancillary Near-Infrared Aerial Imagery
  if (preset === 'webp' || preset === 'rgbnir_zstd') {
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

function allowedDataTypesForPreset(preset: string): Set<string> | null {
  if (preset === 'webp' || preset === 'rgbnir_zstd') return new Set(['uint8', 'uint16']);
  if (preset === 'lzw') return new Set(['uint8']);
  if (preset === 'dem_lerc') return new Set(['float32']);
  return null;
}

/**
 * Validate each tiff against a validation preset
 *
 * Consistency of the data type across tiffs is checked by {@link getTiffsMetadata}
 *
 * @param preset preset to validate against
 * @param tiffs tiffs to validate.
 */
export async function validatePreset(preset: string, tiffs: Tiff[]): Promise<void> {
  let rejected = false;

  const allowedDataTypes = allowedDataTypesForPreset(preset);
  if (allowedDataTypes == null) return;

  const promises = tiffs.map(async (t) => {
    await validateTiffDataType(t, allowedDataTypes).catch((err) => {
      logger.fatal(
        { reason: String(err), source: protocolAwareString(t.source.url), preset },
        'Tiff:ValidatePreset:failed',
      );
      rejected = true;
    });
  });
  await Promise.allSettled(promises);

  if (rejected) throw new Error(`Tiff preset:"${preset}" validation failed`);
}

/**
 * Validate all tiffs have consistent band information
 *
 * @returns list of bands in the first image if consistent with the other images
 * @throws if one image does not have consistent band information
 */
function validateConsistentBands(locs: SourceLocation[]): string[] {
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
 * Group input files by their output tile names.
 *
 * @param locations List of input files to group.
 * @returns Map of tile names to their corresponding input files.
 */
export function groupByTileName(locations: SourceLocation[]): Map<string, SourceLocation[]> {
  const inputs: Map<string, SourceLocation[]> = new Map();
  for (const loc of locations) {
    for (const sheetCode of loc.tileNames) {
      const uris = inputs.get(sheetCode) ?? [];
      uris.push(loc);
      inputs.set(sheetCode, uris);
    }
  }
  return inputs;
}

/**
 * Reproject the bounding box if the source and target projections are different.
 *
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

/** Source file to place on the tile grid */
export interface SourceFile {
  source: URL;
  epsg: number | null | undefined;
  bbox(): Promise<BBox>;
  bands(): Promise<string[]>;
  /** Output tile names from the file's bbox in the `mapSheet` CRS */
  tileNames(bbox: BBox, gridSize: GridSize, mapSheet: MapSheetLike): string[];
  close(): Promise<void>;
}

/** TIFF, placed in every tile it covers */
export class TiffSource implements SourceFile {
  readonly tiff: Tiff;

  constructor(tiff: Tiff) {
    this.tiff = tiff;
  }

  get source(): URL {
    return this.tiff.source.url;
  }

  get epsg(): number | null | undefined {
    return this.tiff.images[0]?.epsg;
  }

  bbox(): Promise<BBox> {
    return findBoundingBox(this.tiff);
  }

  //FIXME: extractBandInformation now runs in getTiffsMetadata, so it runs twice.
  bands(): Promise<string[]> {
    return extractBandInformation(this.tiff);
  }

  tileNames(bbox: BBox, gridSize: GridSize, mapSheet: MapSheetLike): string[] {
    return getCovering(bbox, gridSize, mapSheet);
  }

  async close(): Promise<void> {
    await this.tiff.source.close?.();
  }
}

/** Point cloud, placed in the one tile of its centroid, its points may fall outside it */
export class PointCloudSource implements SourceFile {
  readonly header: LasHeader;

  constructor(header: LasHeader) {
    this.header = header;
  }

  get source(): URL {
    return this.header.source;
  }

  get epsg(): number | undefined {
    return this.header.epsg;
  }

  bbox(): Promise<BBox> {
    return Promise.resolve(this.header.bbox);
  }

  /** Point format and scale, which must match to merge */
  bands(): Promise<string[]> {
    return Promise.resolve([`pdrf${this.header.pointFormat}`, `scale${this.header.scale.join(',')}`]);
  }

  tileNames(bbox: BBox, gridSize: GridSize, mapSheet: MapSheetLike): string[] {
    return [getTileName((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2, gridSize, mapSheet)];
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Create a list of `SourceLocation` from source files by extracting their bounding box and output tile names for a provided `GridSize`.
 *
 * @param files
 * @param gridSize
 * @param forceSourceEpsg
 * @param targetEpsg CRS to align tiles to and calculate map sheet names in, see {@link getMapSheet}. Defaults to each file's own (source) EPSG, ie no reprojection.
 * @returns {SourceLocation[]}
 */
export async function extractLocations(
  files: SourceFile[],
  gridSize: GridSize,
  forceSourceEpsg?: number,
  targetEpsg?: number,
): Promise<SourceLocation[]> {
  const result = await Promise.all(
    files.map(async (file): Promise<SourceLocation | null> => {
      try {
        const sourceBbox = await file.bbox();

        const sourceEpsg = forceSourceEpsg ?? file.epsg;
        if (sourceEpsg == null) {
          logger.error(
            { reason: 'EPSG is missing', source: protocolAwareString(file.source) },
            'MissingEPSG:ExtractLocations:Failed',
          );
          return null;
        }

        // Default to the source EPSG so imagery tiles against its own native map sheet grid
        // unless the caller explicitly asks to reproject into a different one.
        const resolvedTargetEpsg = targetEpsg ?? sourceEpsg;
        const mapSheet = getMapSheet(resolvedTargetEpsg);
        const targetProjection = Projection.get(resolvedTargetEpsg);
        const sourceProjection = Projection.get(sourceEpsg);

        const targetBbox = reprojectIfNeeded(sourceBbox, sourceProjection, targetProjection);

        if (targetBbox === null) {
          logger.error(
            { reason: 'Failed to reproject point', source: protocolAwareString(file.source) },
            'Reprojection:ExtractLocations:Failed',
          );
          return null;
        }

        return {
          bbox: targetBbox,
          source: file.source,
          tileNames: file.tileNames(targetBbox, gridSize, mapSheet),
          epsg: file.epsg,
          bands: await file.bands(),
        };
      } catch (e) {
        logger.error({ reason: e, source: protocolAwareString(file.source) }, 'ExtractLocation:Failed');
        return null;
      } finally {
        await file.close();
      }
    }),
  );

  const output: SourceLocation[] = [];
  for (const o of result) {
    if (o === null) throw new Error('All locations have not been extracted.');
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
 * Get the tile name for a given position and grid size.
 *
 * @param x The x coordinate of the tile.
 * @param y The y coordinate of the tile.
 * @param gridSize The grid size of the tile.
 * @param mapSheet The map sheet grid `x`/`y` are expressed in, see {@link getMapSheet}. Defaults to the mainland NZTM50 grid.
 * @returns The tile name.
 */
export function getTileName(x: number, y: number, gridSize: GridSize, mapSheet: MapSheetLike = MapSheet): string {
  const sheetCode = mapSheet.sheetCode(x, y);
  if (!mapSheet.isKnown(sheetCode)) {
    logger.info(
      { sheetCode, x, y, gridSize },
      `Map sheet (${sheetCode}) at coordinates (${x}, ${y}) is outside the known range.`,
    );
  }

  // Shorter tile names for 1:50k
  if (gridSize === mapSheet.gridSizeMax) return sheetCode;

  const tilesPerMapSheet = Math.floor(mapSheet.gridSizeMax / gridSize);
  const tileWidth = Math.floor(mapSheet.width / tilesPerMapSheet);
  const tileHeight = Math.floor(mapSheet.height / tilesPerMapSheet);

  const nbDigits = gridSize === 500 ? 3 : 2;

  const offsetX = Math.floor((x - mapSheet.origin.x) / mapSheet.width);
  const offsetY = Math.floor((mapSheet.origin.y - y) / mapSheet.height);
  const maxY = mapSheet.origin.y - offsetY * mapSheet.height;
  const minX = mapSheet.origin.x + offsetX * mapSheet.width;
  const tileX = Math.round(Math.floor((x - minX) / tileWidth + 1));
  const tileY = Math.round(Math.floor((maxY - y) / tileHeight + 1));
  const tileId = `${`${tileY}`.padStart(nbDigits, '0')}${`${tileX}`.padStart(nbDigits, '0')}`;
  return `${sheetCode}_${gridSize}_${tileId}`;
}

/**
 * Ensure every band of the tiff has the same data type and that it is one of the allowed data types
 * (e.g. `uint8` or `uint16` for the webp preset).
 *
 * @param tiff
 * @param allowedDataTypes data types in the format of {@link extractBandInformation}, e.g. `uint8`, `float32`
 * @returns the data type of the tiff
 */
export async function validateTiffDataType(tiff: Tiff, allowedDataTypes: Set<string>): Promise<string> {
  const bands = await extractBandInformation(tiff);
  const dataType = bands[0];
  if (dataType == null) {
    throw new Error(`Failed to extract band information from ${protocolAwareString(tiff.source.url)}`);
  }

  if (bands.some((band) => band !== dataType)) {
    throw new Error(`${protocolAwareString(tiff.source.url)} Inconsistent data type across bands: ${bands.join(', ')}`);
  }

  if (!allowedDataTypes.has(dataType)) {
    throw new Error(
      `${protocolAwareString(tiff.source.url)} has unsupported data type: ${dataType}. Expected: ${[...allowedDataTypes].join(', ')}`,
    );
  }
  return dataType;
}

/**
 * Get the list of map sheets / tiles that intersect with the given bounding box.
 *
 * @param bbox Bounding box of the area of interest (in `mapSheet`'s CRS) to get the map sheets for (e.g. TIFF area).
 * @param gridSize Grid size of the map sheets / tiles to get.
 * @param mapSheet The map sheet grid to tile against, see {@link getMapSheet}.
 * @param minIntersectionMeters Minimum intersection area in meters (width or height) to include the map sheet.
 */
function getCovering(bbox: BBox, gridSize: GridSize, mapSheet: MapSheetLike, minIntersectionMeters = 0.15): string[] {
  const SurroundingTiles = [
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
  ];

  const targetBounds = Bounds.fromBbox(bbox);

  const output: string[] = [];
  const tilesPerMapSheetSide = Math.floor(mapSheet.gridSizeMax / gridSize);

  const tileWidth = Math.floor(mapSheet.width / tilesPerMapSheetSide);
  const tileHeight = Math.floor(mapSheet.height / tilesPerMapSheetSide);

  const seen = new Set();
  const todo: Bounds[] = [];

  const sheetName = getTileName(bbox[0], bbox[3], gridSize, mapSheet);
  const sheetInfo = mapSheet.getMapTileIndex(sheetName);
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
    output.push(getTileName(nextX, nextY, gridSize, mapSheet));
  }

  return output.sort();
}
