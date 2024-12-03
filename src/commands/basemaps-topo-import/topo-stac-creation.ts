import { loadTiffsFromPaths } from '@basemaps/config-loader/build//json/tiff.config.js';
import { Bounds } from '@basemaps/geo';
import { fsa } from '@basemaps/shared';
import { Tiff } from '@cogeotiff/core';
import { command, option, string } from 'cmd-ts';
import pLimit from 'p-limit';
import { StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, forceOutput, registerCli, tryParseUrl, UrlFolder, verbose } from '../common.js';
import { groupTiffsByMapCodeAndLatest } from './mappers/group-by-map-code.js';
import { createStacCollection } from './stac/create-stac-collection.js';
import { createStacItemGroups } from './stac/create-stac-item-groups.js';
import { writeStacFiles } from './stac/write-stac-files.js';

const Q = pLimit(10);
export const brokenTiffs = new Map<string, Tiff>();

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
      type: UrlFolder,
      long: 'source',
      description: 'Location of the source files',
    }),
    target: option({
      type: UrlFolder,
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

    const { latest, all } = await loadTiffsToCreateStacs(
      args.source,
      args.target,
      args.title,
      args.forceOutput,
      args.scale,
    );
    if (latest.length === 0 || all.length === 0) throw new Error('No Stac items created');

    const paths: string[] = [];
    all.forEach((item) => paths.push(new URL(`${args.scale}/${item.id}.json`, args.target).href));
    latest.forEach((item) => paths.push(new URL(`${args.scale}-latest/${item.id}.json`, args.target).href));

    // write stac items into an JSON array
    await fsa.write(tryParseUrl(`/tmp/topo-stac-creation/tiles.json`), JSON.stringify(paths, null, 2));

    logger.info({ duration: performance.now() - startTime }, 'ListJobs:Done');
  },
});

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
): Promise<{ latest: StacItem[]; all: StacItem[] }> {
  logger.info({ source }, 'LoadTiffs:Start');
  // extract all file paths from the source directory and convert them into URL objects
  const fileURLs = await fsa.toArray(fsa.list(source));
  // process all of the URL objects into Tiff objects
  const tiffs = await loadTiffsFromPaths(fileURLs, Q);
  logger.info({ numTiffs: tiffs.length }, 'LoadTiffs:End');

  logger.info('GroupTiffs:Start');
  // group all of the Tiff objects by map code, version, and latest
  const groupsByMapCode = await groupTiffsByMapCodeAndLatest(tiffs);
  logger.info({ numGroups: groupsByMapCode.size }, 'GroupTiffs:End');

  logger.info('CreateStacItems:Start');
  const latestBounds: Bounds[] = [];
  const allBounds: Bounds[] = [];

  const latestItems: StacItem[] = [];
  const allItems: StacItem[] = [];

  for (const [mapCode, { latest, others }] of groupsByMapCode.entries()) {
    // push bounds to their respective arrays
    latestBounds.push(latest.bounds);
    allBounds.push(...[latest, ...others].map((vt) => vt.bounds));

    // create StacItem object groups
    const stacItems = await createStacItemGroups(mapCode, latest, others, scale);

    // push StacItem objects to their respective arrays
    latestItems.push(stacItems.latest);
    allItems.push(...stacItems.all);
  }
  logger.info({ numLatestItems: latestItems.length, numItems: allItems.length }, 'CreateStacItems:End');

  // Create collection json for all topo50 items
  logger.info('CreateStacCollections:Start');
  const latestCollection = createStacCollection(title, Bounds.union(latestBounds), latestItems);
  const nonLatestCollection = createStacCollection(title, Bounds.union(allBounds), allItems);

  await writeStacFiles(new URL(`${scale}-latest/`, target), force, latestItems, latestCollection);
  await writeStacFiles(new URL(`${scale}/`, target), force, allItems, nonLatestCollection);
  logger.info({ tiffs: tiffs.length }, 'CreateStacCollections:End');

  return { latest: latestItems, all: allItems };
}
