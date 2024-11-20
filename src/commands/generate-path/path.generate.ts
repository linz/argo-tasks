import { Epsg } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { Tiff } from '@cogeotiff/core';
import { command, option, positional, string } from 'cmd-ts';
import { StacCollection, StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, createTiff, GeospatialDataCategories, registerCli, StacCollectionLinz, verbose } from '../common.js';

export interface PathMetadata {
  targetBucketName: string;
  geospatialCategory: string;
  region: string;
  slug: string;
  gsd: number;
  epsg: number;
}

export const commandGeneratePath = command({
  name: 'generate-path',
  description: 'Generate target path from collection metadata',
  version: CliInfo.version,
  args: {
    config,
    verbose,

    targetBucketName: option({
      type: string,
      long: 'target-bucket-name',
      description: 'Target bucket name, e.g. nz-imagery',
    }),

    source: positional({
      type: string,
      displayName: 'path',
      description: 'path to source data where collection.json file is located',
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();

    logger.info({ source: args.source }, 'GeneratePath:Start');

    const collection = await fsa.readJson<StacCollection & StacCollectionLinz>(
      fsa.join(args.source, 'collection.json'),
    );
    if (collection == null) throw new Error(`Failed to get collection.json from ${args.source}.`);

    const tiff = await loadFirstTiff(args.source, collection);

    const metadata: PathMetadata = {
      targetBucketName: formatBucketName(args.targetBucketName),
      geospatialCategory: collection['linz:geospatial_category'],
      region: collection['linz:region'],
      slug: collection['linz:slug'],
      gsd: extractGsd(tiff),
      epsg: extractEpsg(tiff),
    };

    const target = generatePath(metadata);
    logger.info({ duration: performance.now() - startTime, target: target }, 'GeneratePath:Done');

    // Path to where the target is located
    await fsa.write('/tmp/generate-path/target', target);
    logger.info({ location: '/tmp/generate-path/target', target: target }, 'GeneratePath:Written');
  },
});

/**
 * Generates target path based on dataset category.
 *
 * @param metadata
 * @returns
 */
export function generatePath(metadata: PathMetadata): string {
  if (metadata.geospatialCategory === GeospatialDataCategories.SCANNED_AERIAL_PHOTOS) {
    // nb: Historic Imagery is out of scope as survey number is not yet recorded in collection metadata
    throw new Error(`Historic Imagery ${metadata.geospatialCategory} is out of scope for automated path generation.`);
  }

  if (
    [
      GeospatialDataCategories.URBAN_AERIAL_PHOTOS,
      GeospatialDataCategories.RURAL_AERIAL_PHOTOS,
      GeospatialDataCategories.SATELLITE_IMAGERY,
    ].includes(metadata.geospatialCategory)
  ) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${metadata.slug}/rgb/${metadata.epsg}/`;
  }

  if ([GeospatialDataCategories.DEM, GeospatialDataCategories.DSM].includes(metadata.geospatialCategory)) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${metadata.slug}/${metadata.geospatialCategory}_${metadata.gsd}m/${metadata.epsg}/`;
  }

  throw new Error(
    `Path can't be generated from collection as no matching category for ${metadata.geospatialCategory}.`,
  );
}

function formatBucketName(bucketName: string): string {
  if (bucketName.startsWith('s3://')) return bucketName.replace('s3://', '').replace('/', '');
  return bucketName;
}

/*
 *  nb: The following functions: 'loadFirstTiff', 'extractGsd', and 'extractEpsg' are
 *  workarounds for use until the eo stac extension is added to the collection.json.
 */

/**
 * Gets tiff of first item listed in collection
 *
 * @param source
 * @param collection
 * @returns
 */
export async function loadFirstTiff(source: string, collection: StacCollection): Promise<Tiff> {
  const itemLink = collection.links.find((f) => f.rel === 'item')?.href;
  if (itemLink == null) throw new Error(`No items in collection from ${source}.`);

  const itemPath = new URL(itemLink, source).href;
  const item = await fsa.readJson<StacItem>(itemPath);
  if (item == null) throw new Error(`Failed to get item.json from ${itemPath}.`);

  const tiffLink = item.assets['visual']?.href;
  if (tiffLink == null) throw new Error(`No tiff assets in Item: ${itemPath}`);

  const tiffPath = new URL(tiffLink, source).href;
  const tiff = await createTiff(tiffPath);
  if (tiff == null) throw new Error(`Failed to get tiff from ${tiffPath}.`);
  return tiff;
}

/**
 * Load the ground sample distance from a tiff
 *
 * @throws if no GSD is defined
 *
 * @param tiff to load the data from
 * @returns GSD if it exists
 */
export function extractGsd(tiff: Tiff): number {
  const gsd = tiff.images[0]?.resolution[0];
  if (gsd == null) throw new Error(`Missing resolution tiff tag: ${tiff.source.url.href}`);
  return gsd;
}

/**
 * Load the projection EPSG code from a tiff
 *
 * @throws if no ESPG code is defined
 *
 * @param tiff to load the data from
 * @returns EPSG code if it exists
 */
export function extractEpsg(tiff: Tiff): number {
  const epsg = tiff.images[0]?.epsg;
  if (epsg == null) {
    throw new Error(`Missing epsg tiff tag: ${tiff.source.url.href}`);
  } else if (!Epsg.Codes.has(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg} on tiff: ${tiff.source.url.href}`);
  }
  return epsg;
}
