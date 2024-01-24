import { Epsg } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { command, option, positional, string } from 'cmd-ts';
import { StacCollection, StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { slugify } from '../../utils/slugify.js';
import { config, createTiff, registerCli, verbose } from '../common.js';
import { dataCategories, regions } from './path.constants.js';

export interface PathMetadata {
  targetBucketName: string;
  category: string;
  geographicDescription?: string;
  region: string;
  event?: string;
  date: string;
  gsd: string;
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

    const collection = await fsa.readJson<StacCollection>(fsa.join(args.source, 'collection.json'));
    if (collection == null) throw new Error(`Failed to get collection.json from ${args.source}.`);

    const tiff = await loadFirstTiff(args.source, collection);

    const metadata: PathMetadata = {
      targetBucketName: formatBucketName(args.targetBucketName),
      category: getCategory(collection),
      geographicDescription: getGeographicDescription(collection),
      region: getRegion(collection),
      event: getEvent(collection),
      date: getDate(collection),
      gsd: extractGsd(tiff),
      epsg: extractEpsg(tiff),
    };

    const target = generatePath(metadata);
    logger.info({ duration: performance.now() - startTime, target: target }, 'GeneratePath:Done');
    return target;
  },
});

/**
 *Generates target path based on dataset category.

 * @param {PathMetadata} metadata
 * @returns {string}
 */
export function generatePath(metadata: PathMetadata): string {
  const name = generateName(metadata.region, metadata.geographicDescription, metadata.event);
  if (metadata.category === dataCategories.SCANNED_AERIAL_PHOTOS) {
    // nb: Historic Imagery is out of scope as survey number is not yet recorded in collection metadata
    throw new Error(`Automated target generation not implemented for historic imagery`);
  } else if ([dataCategories.URBAN_AERIAL_PHOTOS, dataCategories.RURAL_AERIAL_PHOTOS].includes(metadata.category)) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${name}_${metadata.date}_${metadata.gsd}/rgb/${metadata.epsg}/`;
  } else if (metadata.category === dataCategories.SATELLITE_IMAGERY) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${name}_${metadata.date}_${metadata.gsd}/rgb/${metadata.epsg}/`;
  } else if ([dataCategories.DEM, dataCategories.DSM].includes(metadata.category)) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${name}_${metadata.date}/${metadata.category}_${metadata.gsd}/${metadata.epsg}/`;
  } else {
    throw new Error(`Path Can't be generated from collection as no matching category: ${metadata.category}.`);
  }
}

function formatBucketName(bucketName: string): string {
  if (bucketName.startsWith('s3://')) {
    return bucketName.replace('s3://', '').replace('/', '');
  }
  return bucketName;
}

/**
 * Generates specific dataset name based on metadata inputs
 *
 * @param {string} region
 * @param {string | undefined} geographicDescription
 * @param {string | undefined} event
 * @returns {string}
 */
export function generateName(
  region: string,
  geographicDescription: string | undefined,
  event: string | undefined,
): string {
  if (geographicDescription) {
    return slugify([geographicDescription, event].filter(Boolean).join('-'));
  }
  return slugify([region, event].filter(Boolean).join('-'));
}

export function getCategory(collection: StacCollection): string {
  const category = (collection['linz:geospatial_category'] as string) || undefined;
  if (!category) {
    throw new Error('No category in collection');
  }
  return category;
}

export function getGeographicDescription(collection: StacCollection): string | undefined {
  // This is optional metadata, therefore returning nothing is ok.
  return (collection['linz:geographic_description'] as string) || undefined;
}

export function getEvent(collection: StacCollection): string | undefined {
  // This is optional metadata, therefore returning nothing is ok.
  return (collection['linz:event_name'] as string) || undefined;
}

export function getRegion(collection: StacCollection): string {
  const region = (collection['linz:region'] as string) || undefined;
  if (!region) throw new Error('No region in collection');
  if (!regions.includes(region)) throw new Error(`Invalid region: ${region}`);
  return region;
}

export function getDate(collection: StacCollection): string {
  const interval = collection.extent.temporal.interval?.[0];
  const startYear = interval[0]?.slice(0, 4);
  const endYear = interval[1]?.slice(0, 4);

  if (!startYear || !endYear) {
    throw new Error(`Missing datetime in interval: ${interval}`);
  }
  if (startYear === endYear) {
    return startYear;
  }
  return `${startYear}-${endYear}`;
}

/*
 *  nb: The following functions: 'loadFirstTiff', 'extractGsd', and 'extractEpsg' are
 *  workarounds for use until the eo stac extension is added to the collection.json.
 */

/**
 * Gets first item & tiff listed in collection
 *
 * @async
 * @param {string} source
 * @param {StacCollection} collection
 * @returns {Promise<CogTiff>}
 */
export async function loadFirstTiff(source: string, collection: StacCollection): Promise<CogTiff> {
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

export function extractGsd(tiff: CogTiff): string {
  const gsd = tiff.images[0]?.resolution[0];
  if (!gsd) {
    throw new Error(`Missing resolution tiff tag`);
  }
  return `${gsd}m`;
}

export function extractEpsg(tiff: CogTiff): number {
  const epsg = tiff.images[0]?.epsg;
  if (!epsg) {
    throw new Error(`Missing epsg tiff tag`);
  } else if (!Epsg.Codes.has(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg}`);
  }
  return epsg;
}
