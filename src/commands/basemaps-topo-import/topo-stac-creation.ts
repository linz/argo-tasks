import { loadTiffsFromPaths } from '@basemaps/config-loader/build//json/tiff.config.js';
import { BoundingBox, Bounds, Nztm2000QuadTms, Projection } from '@basemaps/geo';
import { fsa } from '@basemaps/shared';
import { CliId } from '@basemaps/shared/build/cli/info.js';
import { Tiff } from '@cogeotiff/core';
import { command, option, string } from 'cmd-ts';
import pLimit from 'p-limit';
import path from 'path';
import { StacCollection, StacItem } from 'stac-ts';
import { GeoJSONPolygon } from 'stac-ts/src/types/geojson.js';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { findBoundingBox } from '../../utils/geotiff.js';
import { config, forceOutput, registerCli, tryParseUrl, verbose } from '../common.js';

const Q = pLimit(10);
const projection = Projection.get(Nztm2000QuadTms);
const cliDate = new Date().toISOString();
const brokenTiffs = new Map<string, Tiff>();

/**
 * List all the tiffs in a directory for topographic maps and create cogs for each.
 *
 * @param source: Location of the source files
 * @example s3://linz-topographic-upload/topographic/TopoReleaseArchive/NZTopo50_GeoTif_Gridless/
 *
 * @param target: Location of the target path
 */
export const topoStacCreation = command({
  name: 'topo-stac-creation',
  description: 'List input topographic files, create StacItems, and generate tiles for grouping.',
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
    scale: option({
      type: string,
      long: 'scale',
      description: 'topo50 or topo250',
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('ListJobs:Start');

    const sourceURL = tryParseUrl(args.source);
    const targetURL = tryParseUrl(args.target);

    const { latest, others } = await loadTiffsToCreateStacs(
      sourceURL,
      targetURL,
      args.title,
      args.forceOutput,
      args.scale,
    );
    if (latest.length === 0 || others.length === 0) throw new Error('No Stac items created');

    const paths: string[] = [];
    others.forEach((item) => paths.push(new URL(`${args.scale}/${item.id}.json`, targetURL).href));
    latest.forEach((item) => paths.push(new URL(`${args.scale}-latest/${item.id}.json`, targetURL).href));

    // write stac items into an JSON array
    await fsa.write(tryParseUrl(`/tmp/topo-stac-creation/tiles.json`), JSON.stringify(paths, null, 2));

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

interface VersionedTiff {
  version: string;
  tiff: Tiff;
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
async function loadTiffsToCreateStacs(
  source: URL,
  target: URL,
  title: string,
  force: boolean,
  scale: string,
): Promise<{ latest: StacItem[]; others: StacItem[] }> {
  // extract all file paths from the source directory and convert them into URL objects
  logger.info({ source }, 'LoadTiffs:Start');
  const files = await fsa.toArray(fsa.list(source));
  const tiffs = await loadTiffsFromPaths(files, Q);

  // we need to assign each tiff to a group based on its map code (e.g. AB01)
  // for each group, we then need to identify the latest version and set it aside from the rest
  // the latest version will have special metadata, whereas the rest will have similar metadata

  // group the tiffs by map code
  //
  // {
  //   "AB01": ["v1-00", "v1-01", "v2-00"]
  //   "CD01": ["v1-00", "v2-00", "v2-01"]
  // }
  const versionsByMapCode: Map<string, VersionedTiff[]> = new Map();

  for (const tiff of tiffs) {
    const source = tiff.source.url.href;
    const { mapCode, version } = extractMapSheetNameWithVersion(source);

    const entry = versionsByMapCode.get(mapCode);

    if (entry == null) {
      versionsByMapCode.set(mapCode, [{ version, tiff }]);
    } else {
      entry.push({ version, tiff });
    }
  }

  // for each group, identify the latest version
  //
  // {
  //   "AB01": { latest: "v2-00", others: ["v1-00", "v1-01"] }
  //   "CD01": { latest: "v2-01", others: ["v1-00", "v2-00"] }
  // }
  const groupsByMapCode: Map<string, { latest: VersionedTiff; others: VersionedTiff[] }> = new Map();

  for (const [mapCode, versions] of versionsByMapCode.entries()) {
    const sorted = versions.sort((a, b) => a.version.localeCompare(b.version));

    const latest = sorted[sorted.length - 1];
    if (latest == null) throw new Error();

    const others = sorted.filter((version) => version !== latest);

    groupsByMapCode.set(mapCode, { latest, others });
  }

  const latestStacs: StacItem[] = [];
  const otherStacs: StacItem[] = [];
  let imageryBound: Bounds | undefined;

  logger.info({ tiffs: tiffs.length }, 'CreateStac:Start');

  for (const [mapCode, { latest, others }] of groupsByMapCode.entries()) {
    const stacItems = await createStacItems(mapCode, latest, others, target, scale);
    latestStacs.push(stacItems.latest);
    otherStacs.push(...stacItems.others);

    if (imageryBound == null) {
      imageryBound = stacItems.bounds;
    } else {
      imageryBound = imageryBound.union(stacItems.bounds);
    }
  }

  if (imageryBound == null) throw new Error('No imagery bounds found');

  // Create collection json for all topo50 items
  const latestCollection = createStacCollection(title, imageryBound, latestStacs);
  const collection = createStacCollection(title, imageryBound, otherStacs);

  await writeStacFiles(new URL(`${scale}-latest/`, target), force, latestStacs, latestCollection);
  await writeStacFiles(new URL(`${scale}/`, target), force, otherStacs, collection);

  return { latest: latestStacs, others: otherStacs };
}

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
 * This function needs to create two groups:
 * - StacItem objects that will live in the Topo50 directory
 * - StacItem objects that will live in the Topo250 directory
 *
 * All versions need a StacItem object that lives in the Topo50 dir
 * The latest version needs a second StacItem object that lives in the Topo250 dir
 */
async function createStacItems(
  mapCode: string,
  latest: VersionedTiff,
  others: VersionedTiff[],
  target: URL,
  scale: string,
): Promise<{ latest: StacItem; others: StacItem[]; bounds: Bounds }> {
  const latestStacItem = await createBaseStacItem(mapCode, mapCode, latest.version, latest.tiff);
  const othersStacItems = await Promise.all(
    [...others, latest].map(({ version, tiff }) => createBaseStacItem(`${mapCode}_${version}`, mapCode, version, tiff)),
  );

  // need to do the part where they add special fields to each group
  const latestURL = new URL(`${scale}/${mapCode}_${latest.version}.json`, target);

  // add link to others pointing to latest
  othersStacItems.forEach((item) => {
    item?.links.push({
      href: latestURL.href,
      rel: 'latest-version',
      type: 'application/json',
    });
  });

  // add link to latest referencing its copy that will live in topo50 dir
  latestStacItem?.links.push({
    href: latestURL.href,
    rel: 'derived_from',
    type: 'application/json',
  });

  // since all of the given tiffs are for the same map code,
  // their bounds should be the same, so we can grab the bounds of the latest
  try {
    const bounds = Bounds.fromBbox(await findBoundingBox(latest.tiff));

    if (latestStacItem == null) {
      throw new Error(`Error creating StacItem for latest version of ${mapCode} sheets`);
    }

    return { latest: latestStacItem, others: othersStacItems.flatMap((item) => (item ? item : [])), bounds };
  } catch (e) {
    throw new Error(`Couldn't extract bounds from the ${mapCode}'s latest map sheet`);
  }
}

async function createBaseStacItem(id: string, mapCode: string, version: string, tiff: Tiff): Promise<StacItem | null> {
  const source = tiff.source.url.href;

  let bounds;
  try {
    bounds = Bounds.fromBbox(await findBoundingBox(tiff));
  } catch (e) {
    brokenTiffs.set(id, tiff);
    return null;
  }

  logger.info({ id }, 'CreateStac:Item');
  const item: StacItem = {
    id: id,
    type: 'Feature',
    collection: CliId,
    stac_version: '1.0.0',
    stac_extensions: [],
    geometry: projection.boundsToGeoJsonFeature(bounds).geometry as GeoJSONPolygon,
    bbox: projection.boundsToWgs84BoundingBox(bounds),
    links: [
      { href: `./${id}.json`, rel: 'self' },
      { href: './collection.json', rel: 'collection' },
      { href: './collection.json', rel: 'parent' },
      { href: source, rel: 'linz_basemaps:source', type: 'image/tiff; application=geotiff' },
    ],
    properties: {
      mapCode,
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

  return item;
}

function createStacCollection(title: string, imageryBound: BoundingBox, items: StacItem[]): StacCollection {
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

  return collection;
}

async function writeStacFiles(
  target: URL,
  force: boolean,
  items: StacItem[],
  collection: StacCollection,
): Promise<void> {
  // Create collection json for all topo50-latest items.
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

  const brokenPath = new URL('/tmp/topo-stac-creation/output/broken.json', target);
  await fsa.write(brokenPath, JSON.stringify(Array.from(brokenTiffs.keys()), null, 2));
}
