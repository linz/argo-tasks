import { loadTiffsFromPaths } from '@basemaps/config-loader/build//json/tiff.config.js';
import { Bounds } from '@basemaps/geo';
import { fsa } from '@basemaps/shared';
import { command, option, string } from 'cmd-ts';
import pLimit from 'p-limit';
import { StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { config, forceOutput, registerCli, tryParseUrl, UrlFolder, verbose } from '../common.js';
import { groupTiffsByDirectory } from './mappers/group-tiffs-by-directory.js';
import { createStacCollection } from './stac/create-stac-collection.js';
import { createStacItemPair } from './stac/create-stac-item-groups.js';
import { writeStacFiles } from './stac/write-stac-files.js';
import { ByDirectory } from './types/by-directory.js';
import { TiffItem } from './types/tiff-item.js';

const Q = pLimit(10);
export const brokenTiffs = { noBounds: [] as string[], noEpsg: [] as string[] };

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
    latest.forEach((item) => paths.push(new URL(`${args.scale}_latest/${item.id}.json`, args.target).href));

    // write stac items into an JSON array
    if (args.forceOutput || isArgo()) {
      if (isArgo()) {
        await fsa.write(tryParseUrl(`/tmp/topo-stac-creation/tiles.json`), JSON.stringify(paths, null, 2));
        await fsa.write(tryParseUrl(`/tmp/topo-stac-creation/brokenTiffs.json`), JSON.stringify(brokenTiffs, null, 2));
      } else {
        await fsa.write(new URL('tiles.json', args.target), JSON.stringify(paths, null, 2));
        await fsa.write(new URL('brokenTiffs.json', args.target), JSON.stringify(brokenTiffs, null, 2));
      }
    }

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

  // group all of the Tiff objects by epsg and map code
  logger.info('GroupTiffs:Start');

  const itemsByDir = await groupTiffsByDirectory(tiffs);
  const itemsByDirPath = new URL('itemsByDirectory.json', target);
  await fsa.write(itemsByDirPath, JSON.stringify(itemsByDir, null, 2));

  logger.info('GroupTiffs:End');

  // pair all of the TiffItem objects with StacItem objects
  logger.info('CreateStacItems:Start');

  const pairsByDir = new ByDirectory<{ item: TiffItem; stac: StacItem }>();

  for (const [epsg, itemsByMapCode] of itemsByDir.all.entries()) {
    for (const [mapCode, items] of itemsByMapCode.entries()) {
      // get latest item
      const latest = itemsByDir.latest.get(epsg).get(mapCode);

      // create stac items
      const stacItems = await createStacItemPair(scale, mapCode, items, latest);

      // store stac items
      pairsByDir.all.get(epsg).set(mapCode, stacItems.all);
      pairsByDir.latest.get(epsg).set(mapCode, stacItems.latest);
    }
  }

  // const pairsByDirPath = new URL('pairsByDirectory.json', target);
  // await fsa.write(pairsByDirPath, JSON.stringify(pairsByDir, null, 2));

  logger.info('CreateStacItems:End');

  logger.info('WriteStacFiles:Start');

  const latestItems: StacItem[] = [];
  const allItems: StacItem[] = [];

  // write 'all' stac items and collection
  for (const [epsg, pairsByMapCode] of pairsByDir.all.entries()) {
    const boundsByEpsg: Bounds[] = [];
    const itemsByEpsg: StacItem[] = [];

    for (const [, pairs] of pairsByMapCode.entries()) {
      for (const pair of pairs) {
        boundsByEpsg.push(pair.item.bounds);
        itemsByEpsg.push(pair.stac);
        allItems.push(pair.stac);
      }
    }

    // create collection
    const collection = createStacCollection(title, Bounds.union(boundsByEpsg), itemsByEpsg);
    // write stac items and collection
    await writeStacFiles(new URL(`${scale}/${epsg}/`, target), force, itemsByEpsg, collection);
  }

  // write 'latest' stac items and collection
  for (const [epsg, itemsByMapCode] of pairsByDir.latest.entries()) {
    const boundsByEpsg: Bounds[] = [];
    const itemsByEpsg: StacItem[] = [];

    for (const [, pair] of itemsByMapCode.entries()) {
      boundsByEpsg.push(pair.item.bounds);
      itemsByEpsg.push(pair.stac);
      latestItems.push(pair.stac);
    }

    // create collection
    const collection = createStacCollection(title, Bounds.union(boundsByEpsg), itemsByEpsg);
    // write stac items and collection
    await writeStacFiles(new URL(`${scale}_latest/${epsg}/`, target), force, itemsByEpsg, collection);
  }

  logger.info('WriteStacFiles:End');

  return { latest: latestItems, all: allItems };
}
