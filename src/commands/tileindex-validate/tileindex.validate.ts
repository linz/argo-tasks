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
import { findBoundingBox, findResolution, isTiff } from '../../utils/geotiff.ts';
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
   * List of bands inside a TIFF in the format `uint8',`uint16`, `uint32`, empty for point clouds
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

export interface SourceCrs {
  epsg: number;
  verticalEpsg?: number;
}

export const SourceEpsgFromString: Type<string, SourceCrs> = {
  /**
   * Parse a horizontal EPSG code with an optional vertical one, eg "2193", "2193+7839" or "EPSG:2193+7839".
   *
   * @param value The input string.
   * @returns The horizontal and vertical EPSG codes.
   */
  // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
  async from(value) {
    const match = /^(?:EPSG:)?(\d+)(?:\+(\d+))?$/i.exec(value.trim());
    if (match?.[1] == null) throw new Error(`Invalid source-epsg "${value}", eg "2193" or "2193+7839"`);
    const epsg = Number(match[1]);
    return match[2] == null ? { epsg } : { epsg, verticalEpsg: Number(match[2]) };
  },
};

export const SourceTypes = ['raster', 'pointcloud'] as const;
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
        'Type of the input files, TIFFs or LAS/LAZ point clouds. Point clouds are placed in the tile of their centroid',
      defaultValueIsSerializable: true,
      defaultValue: (): SourceType => 'raster',
    }),
    sourceEpsg: option({
      type: optional(SourceEpsgFromString),
      long: 'source-epsg',
      description:
        'Force epsg code for input files. Point clouds can add a vertical code, eg 2193+7839 for NZTM2000 + NZVD2016 height',
    }),
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
   * Group input TIFFs or point clouds to their output tile names on a LINZ map sheet tile index.
   * TIFFs go to every tile they cover, point clouds to the tile of their centroid.
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
   * Create a re-tiling output of  1 input file = 100x {tileName, input: string}[]
   *
   * If --includeDerived
   * Sets includeDerived in file-list.json (determines whether to create derived_from links in STAC)
   *
   * @output
   * /tmp/tile-index-validate/input.geojson
   * Geometry:
   *  bounding boxes of the input files.
   *
   * Attributes:
   * - source (string): path to source file
   * - tileName (string): calculated target tileName
   *
   * /tmp/tile-index-validate/output.geojson
   * Geometry:
   *  bounding boxes of the target tiles
   *
   * Attributes:
   * - source (string[]): paths to source files
   * - tileName (string): target tileName for target tile index
   *
   * /tmp/tile-index-validate/file-list.json
   * Filelist grouped by target tileNames with includeDerived flag
   *
   * Attributes:
   * - input (string[]): paths to source files, in order of their most specific location, so later ones take priority
   * - output (string): target tileName for target tile index
   * - includeDerived (boolean): include input tiles as STAC `derived_from` links
   *
   * /tmp/tile-index-validate/gsd, data-type, density, point-format, crs
   * Text files, empty when not applicable: GSD and band data type of TIFFs, points per m², point format and `EPSG:<horizontal>+<vertical>` CRS of point clouds
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

    const input = args.sourceType === 'pointcloud' ? await loadPointClouds(args) : await loadRaster(args);

    const groupByTileNameStartTime = performance.now();
    const locations = await extractLocations(input.files, input.gridSize, args.sourceEpsg?.epsg, input.targetEpsg);
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
      await generateOutputFiles(locations, outputTiles, input.targetEpsg, args.includeDerived, input.outputs);
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
    const hosts = new Set<string>();
    /** File href to its listing position and most specific location's href length */
    const listingOrder = new Map<string, { position: number; specificity: number }>();

    const totalTime = performance.now();
    let progressTime = totalTime;

    /** Number of files loaded or failed */
    let loadedCount = 0;
    /** Number of files listed, including duplicates */
    let listedCount = 0;
    /** Number of files that failed to load */
    let failedCount = 0;
    const output: T[] = [];
    let lastError: unknown = null;

    for (const loc of locations) {
      for await (const file of asyncFilter(fsa.details(loc), args)) {
        if (!type.accept(file.url)) continue;
        const existing = listingOrder.get(file.url.href);
        // Deepest location wins, the later one on ties
        if (existing == null || loc.href.length >= existing.specificity) {
          listingOrder.set(file.url.href, { position: listedCount, specificity: loc.href.length });
        }
        listedCount++;
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
              loadedCount++;
              if (loadedCount % 1_000 === 0) {
                logger.info(
                  {
                    source: protocolAwareString(file.url),
                    loaded: loadedCount,
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
              loadedCount++;
              lastError = e;
            });
        });

        if (q.todo.size > 2_500) await q.join();
      }
    }

    const duplicates = listedCount - listingOrder.size;
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
  /** Text outputs by file name, all written so the Argo output parameters resolve, empty when not applicable */
  outputs: Record<'gsd' | 'data-type' | 'density' | 'point-format' | 'crs', string>;
}

/** Load and validate the input TIFFs */
async function loadRaster(args: CommandTileIndexValidateArgs): Promise<TileIndexInput> {
  if (args.sourceEpsg?.verticalEpsg != null) {
    throw new Error('TIFFs have no vertical CRS, set --source-epsg without "+<vertical>"');
  }
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
  const targetEpsg = args.targetEpsg ?? args.sourceEpsg?.epsg ?? [...tiffsMetadata.projections][0] ?? EpsgCode.Nztm2000;

  return {
    files,
    gridSize,
    targetEpsg,
    outputs: {
      gsd: String([...tiffsMetadata.roundedGsds][0]),
      'data-type': String([...tiffsMetadata.dataTypes][0]),
      density: '',
      'point-format': '',
      crs: '',
    },
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
  const crs = validatePointCloudCrs(files, args.sourceEpsg?.epsg, args.sourceEpsg?.verticalEpsg);
  const pointFormat = validateSame(files, 'point formats', (f) => String(f.header.pointFormat));
  validateSame(files, 'scales', (f) => f.header.scale.join(','));
  return {
    files,
    gridSize: args.scale,
    targetEpsg: args.targetEpsg ?? args.sourceEpsg?.epsg ?? files[0]?.epsg ?? EpsgCode.Nztm2000,
    outputs: {
      gsd: '',
      'data-type': '',
      density: String(medianDensity(files)),
      'point-format': pointFormat,
      crs,
    },
  };
}

/** Most common value, undefined on a tie, and the items with another value */
function majority<T>(items: T[], value: (item: T) => string): { common?: string; others: T[] } {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(value(item), (counts.get(value(item)) ?? 0) + 1);
  const [first, second] = [...counts].sort((a, b) => b[1] - a[1]);
  const common = first != null && first[1] !== second?.[1] ? first[0] : undefined;
  return { common, others: items.filter((item) => value(item) !== common) };
}

function mostFiles(common: string | undefined): string {
  return common == null ? 'no value is most common' : `most files are ${common}`;
}

/**
 * Fail on point clouds without one shared horizontal + vertical CRS, listing the bad files. The source EPSG codes force the CRS
 *
 * @returns the CRS of all files, eg `EPSG:2193+7839`
 */
function validatePointCloudCrs(
  files: PointCloudSource[],
  forceSourceEpsg?: number,
  forceVerticalEpsg?: number,
): string {
  const crs = (f: PointCloudSource): string =>
    `EPSG:${forceSourceEpsg ?? f.epsg}+${forceVerticalEpsg ?? f.header.verticalEpsg}`;
  const problems = new Map<PointCloudSource, string>();
  for (const f of files) {
    const { epsg, verticalEpsg, verticalDatum } = f.header;
    if (forceSourceEpsg == null && epsg == null) problems.set(f, 'no horizontal CRS');
    else if (forceVerticalEpsg != null) continue;
    else if (verticalEpsg == null) problems.set(f, 'no vertical CRS');
    else if (verticalDatum === verticalEpsg) problems.set(f, `vertical datum is the CRS code ${verticalDatum}`);
  }
  const { common, others } = majority(
    files.filter((f) => !problems.has(f)),
    crs,
  );
  for (const f of others) problems.set(f, `${crs(f)}, ${mostFiles(common)}`);
  if (problems.size > 0) {
    throw new Error(
      'Point cloud CRS check failed, fix these files or set --source-epsg, eg 2193+7839:\n' + listFiles([...problems]),
    );
  }
  return common ?? '';
}

const MaxListedFiles = 20;

/** A `source: value` line per file, the first {@link MaxListedFiles} only */
function listFiles(files: [SourceFile, string][]): string {
  const lines = files.slice(0, MaxListedFiles).map(([f, value]) => `${protocolAwareString(f.source)}: ${value}`);
  if (files.length > MaxListedFiles) lines.push(`...and ${files.length - MaxListedFiles} more`);
  return lines.join('\n');
}

/**
 * Fail on point clouds with mixed values, listing the files that differ from the most common one
 *
 * @returns the value of all files
 */
function validateSame(files: PointCloudSource[], name: string, value: (f: PointCloudSource) => string): string {
  const { common, others } = majority(files, value);
  if (common == null || others.length > 0) {
    throw new Error(`Mixed ${name}, ${mostFiles(common)}:\n` + listFiles(others.map((f) => [f, value(f)])));
  }
  return common;
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
 * @param outputs Text outputs by file name, eg the ground sample distance in `gsd`.
 */
async function generateOutputFiles(
  locations: SourceLocation[],
  outputTiles: Map<string, SourceLocation[]>,
  targetEpsg: number,
  includeDerived: boolean,
  outputs: TileIndexInput['outputs'],
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

  await fsa.write(inputGeoJsonFileName, JSON.stringify(inputGeoJson));
  logger.info({ path: protocolAwareString(inputGeoJsonFileName) }, 'Write:InputGeoJson');

  await fsa.write(outputGeoJsonFileName, JSON.stringify(outputGeojson));
  logger.info({ path: protocolAwareString(outputGeoJsonFileName) }, 'Write:OutputGeojson');

  const fileList = createFileList(outputTiles, includeDerived);
  await fsa.write(fileListFileName, JSON.stringify(fileList));
  logger.info({ path: protocolAwareString(fileListFileName), count: outputTiles.size }, 'Write:FileList');

  for (const [name, value] of Object.entries(outputs)) {
    const fileName = fsa.toUrl(`/tmp/tile-index-validate/${name}`);
    await fsa.write(fileName, value);
    logger.info({ path: protocolAwareString(fileName), value }, 'Write:Output');
  }
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
  if (preset === 'dem_lerc' || preset === 'intensity_zstd') {
    if (gsd < 0.2) return 1000;
    if (gsd >= 0.2 && gsd <= 1.0) return 10000;
    if (gsd > 1.0) return 50000;
  }

  throw new Error(`Unknown preset: ${preset}`);
}

function allowedDataTypesForPreset(preset: string): Set<string> | null {
  if (preset === 'webp' || preset === 'rgbnir_zstd') return new Set(['uint8', 'uint16']);
  if (preset === 'intensity_zstd') return new Set(['uint16']);
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

  /** None, point format and scale are checked for all point clouds when loading */
  bands(): Promise<string[]> {
    return Promise.resolve([]);
  }

  tileNames(bbox: BBox, gridSize: GridSize, mapSheet: MapSheetLike): string[] {
    const x = (bbox[0] + bbox[2]) / 2;
    const y = (bbox[1] + bbox[3]) / 2;
    if (!mapSheet.isKnown(mapSheet.sheetCode(x, y))) {
      throw new Error(`Point cloud centroid ${x}, ${y} is outside the ${mapSheet.name} map sheets`);
    }
    return [getTileName(x, y, gridSize, mapSheet)];
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

/** Why a source file was not placed on the tile grid, and its log message */
interface LocationFailure {
  reason: string;
  msg: string;
}

/**
 * Create a list of `SourceLocation` from source files by extracting their bounding box and output tile names for a provided `GridSize`.
 * Logs and lists the first {@link MaxListedFiles} failed files only.
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
    files.map(async (file): Promise<SourceLocation | LocationFailure> => {
      try {
        const sourceBbox = await file.bbox();

        const sourceEpsg = forceSourceEpsg ?? file.epsg;
        if (sourceEpsg == null) return { reason: 'EPSG is missing', msg: 'MissingEPSG:ExtractLocations:Failed' };

        // Default to the source EPSG so imagery tiles against its own native map sheet grid
        // unless the caller explicitly asks to reproject into a different one.
        const resolvedTargetEpsg = targetEpsg ?? sourceEpsg;
        const mapSheet = getMapSheet(resolvedTargetEpsg);
        const targetProjection = Projection.get(resolvedTargetEpsg);
        const sourceProjection = Projection.get(sourceEpsg);

        const targetBbox = reprojectIfNeeded(sourceBbox, sourceProjection, targetProjection);

        if (targetBbox === null) {
          return { reason: 'Failed to reproject point', msg: 'Reprojection:ExtractLocations:Failed' };
        }

        return {
          bbox: targetBbox,
          source: file.source,
          tileNames: file.tileNames(targetBbox, gridSize, mapSheet),
          epsg: file.epsg,
          bands: await file.bands(),
        };
      } catch (e) {
        return { reason: e instanceof Error ? e.message : String(e), msg: 'ExtractLocations:Failed' };
      } finally {
        await file.close();
      }
    }),
  );

  const failures = files.flatMap((file, i): [SourceFile, LocationFailure][] => {
    const r = result[i];
    return r != null && 'reason' in r ? [[file, r]] : [];
  });
  if (failures.length > 0) {
    for (const [file, { reason, msg }] of failures.slice(0, MaxListedFiles)) {
      logger.error({ reason, source: protocolAwareString(file.source) }, msg);
    }
    if (failures.length > MaxListedFiles) {
      logger.error({ failedCount: failures.length, more: failures.length - MaxListedFiles }, 'ExtractLocations:Failed');
    }
    throw new Error('ExtractLocations:Failed\n' + listFiles(failures.map(([file, { reason }]) => [file, reason])));
  }
  return result.filter((r): r is SourceLocation => !('reason' in r));
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
