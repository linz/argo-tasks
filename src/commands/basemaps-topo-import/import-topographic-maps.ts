import { tmpdir } from 'node:os';

import { GdalRunner } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { loadTiffsFromPaths } from '@basemaps/config-loader/build//json/tiff.config.js';
import { Bounds, Nztm2000QuadTms, Projection } from '@basemaps/geo';
import { fsa } from '@basemaps/shared';
import { CliId } from '@basemaps/shared/build/cli/info.js';
import { Tiff } from '@cogeotiff/core';
import { command, option, string } from 'cmd-ts';
import { mkdir, rm } from 'fs/promises';
import pLimit from 'p-limit';
import path from 'path';
import { StacCollection, StacItem } from 'stac-ts';
import { GeoJSONPolygon } from 'stac-ts/src/types/geojson.js';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { findBoundingBox } from '../../utils/geotiff.js';
import { HashTransform } from '../../utils/hash.stream.js';
import { config, forceOutput, registerCli, tryParseUrl, verbose } from '../common.js';
import { gdalBuildCogCommands } from './gdal-commands.js';

const Q = pLimit(10);

/**
 * List all the tiffs in a directory for topographic maps and create cogs for each.
 *
 * @param source: Location of the source files
 * @example s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/
 *
 * @param target: Location of the target path
 */
export const importTopographicMaps = command({
  name: 'import-topographic-maps',
  description: 'List input topographic files and run dgal to standardize and import into target.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    forceOutput,
    title: option({
      type: string,
      long: 'title',
      description: 'Imported imagery title',
    }),
    source: option({
      type: string,
      long: 'source',
      description: 'Location of the source files',
    }),
    target: option({
      type: string,
      long: 'target',
      description: 'Target location for the output files',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('ListJobs:Start');

    const items = await loadTiffsToCreateStacs(
      tryParseUrl(args.source),
      tryParseUrl(args.target),
      args.title,
      args.forceOutput,
    );
    if (items.length === 0) throw new Error('No Stac items created');

    const tmpPath = path.join(tmpdir(), CliId);
    const tmpURL = tryParseUrl(tmpPath);
    const tmpFolder = tmpURL.href.endsWith('/') ? new URL(tmpURL.href) : new URL(`${tmpURL.href}/`);
    await Promise.all(
      items.map((item) =>
        Q(async () => {
          await createCogs(item, tryParseUrl(args.target), tmpFolder);
        }),
      ),
    );

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

/**
 * Extract the map code and version from the provided path.
 * Throws an error if either detail cannot be parsed.
 *
 * @param file: filepath from which to extract the map code and version
 *
 * @example
 * file: "s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/CJ10_GRIDLESS_GeoTifv1-00.tif"
 * returns: { mapCode: "CJ10", version: "v1-00" }
 *
 * @returns an object containing the map code and version
 */
export function extractMapSheetNameWithVersion(file: string): { mapCode: string; version: string } {
  const url = tryParseUrl(file);
  const filePath = path.parse(url.href);
  const fileName = filePath.name;

  // extract map code from head of the file name (e.g. CJ10)
  const mapCode = fileName.split('_')[0];
  if (mapCode == null) throw new Error('Map sheet not found in the file name');

  // extract version from tail of the file name (e.g. v1-0)
  const version = fileName.match(/v(\d)-(\d\d)/)?.[0];
  if (version == null) throw new Error('Version not found in the file name');

  logger.info({ mapCode, version }, 'ListJobs:Output');
  return { mapCode, version };
}

/**
 * @param source: Source directory URL from which to load tiff files
 * @example TODO
 *
 * @param target: Destination directory URL into which to save the STAC collection and item JSON files
 * @example TODO
 *
 * @param title: The title of the collection
 * @example "New Zealand Topo50 Map Series (Gridless)"
 *
 * @returns an array of StacItem objects
 */
async function loadTiffsToCreateStacs(source: URL, target: URL, title: string, force: boolean): Promise<StacItem[]> {
  // extract all file paths from the source directory and convert them into URL objects
  logger.info({ source }, 'LoadTiffs:Start');
  const files = await fsa.toArray(fsa.list(source));
  const tiffs = await loadTiffsFromPaths(files, Q);
  const projection = Projection.get(Nztm2000QuadTms);
  const cliDate = new Date().toISOString();

  const items: StacItem[] = [];
  let imageryBound: Bounds | undefined;
  logger.info({ tiffs: tiffs.length }, 'CreateStac:Start');
  const brokenTiffs = new Map<string, Tiff>();
  for (const tiff of tiffs) {
    const source = tiff.source.url.href;
    const { mapCode, version } = extractMapSheetNameWithVersion(source);
    const tileName = `${mapCode}_${version}`;
    let bounds;
    try {
      bounds = Bounds.fromBbox(await findBoundingBox(tiff));
    } catch (e) {
      brokenTiffs.set(tileName, tiff);
      continue;
    }
    if (imageryBound == null) {
      imageryBound = bounds;
    } else {
      imageryBound = imageryBound.union(bounds);
    }

    logger.info({ tileName }, 'CreateStac:Item');
    const item: StacItem = {
      id: tileName,
      type: 'Feature',
      collection: CliId,
      stac_version: '1.0.0',
      stac_extensions: [],
      geometry: projection.boundsToGeoJsonFeature(bounds).geometry as GeoJSONPolygon,
      bbox: projection.boundsToWgs84BoundingBox(bounds),
      links: [
        { href: `./${tileName}.json`, rel: 'self' },
        { href: './collection.json', rel: 'collection' },
        { href: './collection.json', rel: 'parent' },
        { href: source, rel: 'linz_basemaps:source', type: 'image/tiff; application=geotiff' },
      ],
      properties: {
        version,
        datetime: cliDate,
        start_datetime: undefined,
        end_datetime: undefined,
        'proj:epsg': projection.epsg.code,
        created_at: cliDate,
        updated_at: cliDate,
        'linz:lifecycle': 'ongoing',
        'linz:geospatial_category': 'topographic-maps',
        'linz:region': 'new-zealand',
        'linz:security_classification': 'unclassified',
        'linz:slug': 'topo50',
      },
      assets: {},
    };
    items.push(item);
  }
  if (imageryBound == null) throw new Error('No imagery bounds found');

  logger.info({ items: items.length }, 'CreateStac:Collection');
  const collection: StacCollection = {
    id: CliId,
    type: 'Collection',
    stac_version: '1.0.0',
    stac_extensions: [],
    license: 'CC-BY-4.0',
    title,
    description: 'Topographic maps of New Zealand',
    providers: [{ name: 'Land Information New Zealand', roles: ['host', 'licensor', 'processor', 'producer'] }],
    extent: {
      spatial: { bbox: [projection.boundsToWgs84BoundingBox(imageryBound)] },
      // Default  the temporal time today if no times were found as it is required for STAC
      temporal: { interval: [[cliDate, null]] },
    },
    links: items.map((item) => {
      return { href: `./${item.id}.json`, rel: 'item', type: 'application/json' };
    }),
  };

  if (force || isArgo()) {
    logger.info({ target }, 'CreateStac:Output');
    logger.info({ items: items.length, collectionID: collection.id }, 'Stac:Output');
    for (const item of items) {
      const itemPath = new URL(`${item.id}.json`, target);
      await fsa.write(itemPath, JSON.stringify(item, null, 2));
    }
    const collectionPath = new URL('collection.json', target);
    await fsa.write(collectionPath, JSON.stringify(collection, null, 2));
  }

  const brokenPath = new URL('./broken/broken.json', target);
  await fsa.write(brokenPath, JSON.stringify(Array.from(brokenTiffs.keys()), null, 2));

  return items;
}

async function createCogs(item: StacItem, target: URL, tmp: URL): Promise<void> {
  const tmpFolder = new URL(item.id, tmp);
  try {
    // Extract the source URL from the item
    logger.info({ item: item.id }, 'CogCreation:Start');
    const source = item.links.find((l) => l.rel === 'linz_basemaps:source')?.href;
    if (source == null) throw new Error('No source file found in the item');
    await mkdir(tmpFolder, { recursive: true });

    // Download the source file

    const sourceUrl = tryParseUrl(source);
    const filePath = path.parse(sourceUrl.href);
    const fileName = filePath.base;
    const hashStreamSource = fsa.readStream(sourceUrl).pipe(new HashTransform('sha256'));
    const inputPath = new URL(fileName, tmpFolder);
    logger.info({ item: item.id, download: inputPath.href }, 'CogCreation:Download');
    await fsa.write(inputPath, hashStreamSource);

    // run gdal_translate for each job
    logger.info({ item: item.id }, 'CogCreation:gdal_translate');
    const tempPath = new URL(`${item.id}.tiff`, tmpFolder);
    const command = gdalBuildCogCommands(inputPath, tempPath);
    await new GdalRunner(command).run(logger);

    // fsa.write output to target location
    logger.info({ item: item.id }, 'CogCreation:Output');
    const readStream = fsa.readStream(tempPath).pipe(new HashTransform('sha256'));
    const outputPath = new URL(`${item.id}.tiff`, target);
    await fsa.write(outputPath, readStream);
  } finally {
    // Cleanup the temporary folder once everything is done
    logger.info({ path: tmpFolder.href }, 'CogCreation:Cleanup');
    await rm(tmpFolder.href, { recursive: true, force: true });
  }
}
