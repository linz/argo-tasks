import { Epsg } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { command, option, positional, string } from 'cmd-ts';
import { StacCollection, StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, createTiff, registerCli, verbose } from '../common.js';
import { dataCategories, regions } from './path.constants.js';

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

    if (args.targetBucketName.startsWith('s3://')) {
      throw new Error(
        `target-bucket-name entered as path, did you mean ${args.targetBucketName
          .replace('s3://', '')
          .replace('/', '')}?`,
      );
    }

    logger.info({ source: args.source }, 'GeneratePath:Start');

    const collection = await fsa.readJson<StacCollection>(fsa.join(args.source, 'collection.json'));
    if (collection == null) throw new Error(`Failed to get collection.json from ${args.source}.`);

    const tiff = await loadFirstTiff(args.source, collection);

    const category = getCategory(collection);
    const geographicDescription = getGeographicDescription(collection);
    const region = getRegion(collection);
    const event = getEvent(collection);
    const date = getDate(collection);
    const gsd = extractGsd(tiff);
    const epsg = extractEpsg(tiff);

    const target = generatePath(args.targetBucketName, category, geographicDescription, region, event, date, gsd, epsg);
    logger.info({ duration: performance.now() - startTime, target: target }, 'GeneratePath:Done');
    return target;
  },
});

/**
 * Generates Target Path based on category
 *
 * @param {string} targetBucketName
 * @param {string} category
 * @param {string} geospaital_description
 * @param {string} region
 * @param {string} event
 * @param {string} date
 * @param {string} gsd
 * @param {string} epsg
 * @returns {string}
 */
export function generatePath(
  targetBucketName: string,
  category: string,
  geospaital_description: string,
  region: string,
  event: string,
  date: string,
  gsd: string,
  epsg: string,
): string {
  const name = generateName(region, geospaital_description, event);

  if (category === dataCategories.SCANNED_AERIAL_PHOTOS) {
    // nb: Historic Imagery is out of scope as survey number is not yet recorded in collection metadata (15/02/24)
    throw new Error(`Automated target generation not implemented for historic imagery`);
  } else if ([dataCategories.URBAN_AERIAL_PHOTOS, dataCategories.RURAL_AERIAL_PHOTOS].includes(category)) {
    return `s3://${targetBucketName}/${region}/${name}_${date}_${gsd}/rgb/${epsg}/`;
  } else if (category === dataCategories.SATELLITE_IMAGERY) {
    return `s3://${targetBucketName}/${region}/${name}_${date}_${gsd}/rgb/${epsg}/`;
  } else if ([dataCategories.DEM, dataCategories.DSM].includes(category)) {
    return `s3://${targetBucketName}/${region}/${name}_${date}/${category}_${gsd}/${epsg}/`;
  } else {
    throw new Error(`Path Can't be generated from collection as no matching category: ${category}.`);
  }
}

/**
 * Generates specific dataset name based on metadata inputs
 *
 * @param {string} region
 * @param {string} geospaital_description
 * @param {string} event
 * @returns {string}
 */
export function generateName(region: string, geospatial_description: string, event: string): string {
  let name = region;
  if (geospaital_description) {
    name = geospaital_description.toLowerCase().replace(/\s+/g, '-');
  }
  if (event) {
    name = `${name}-${event.toLowerCase().replace(/\s+/g, '-')}`;
  }
  return name;
}

export function getCategory(collection: StacCollection): string {
  const category = collection['linz:geospatial_category'] as string;
  if (!category) {
    throw new Error('No category in collection');
  }
  return category;
}

export function getGeographicDescription(collection: StacCollection): string {
  // This is optional metadata, therefore returning nothing is ok.
  return collection['linz:geographic_description'] as string;
}

export function getEvent(collection: StacCollection): string {
  // This is optional metadata, therefore returning nothing is ok.
  return collection['linz:event_name'] as string;
}

export function getRegion(collection: StacCollection): string {
  const region = collection['linz:region'] as string;
  if (!region) {
    throw new Error('No region in collection');
  } else if (!regions.includes(region)) {
    throw new Error(`Invalid region: ${region}`);
  }
  return region;
}

export function getDate(collection: StacCollection): string {
  const interval = collection.extent.temporal.interval[0];
  const startYear = interval[0];
  const endYear = interval[1];

  if (!startYear || !endYear) {
    throw new Error(`Missing datetime in interval: ${interval}`);
  }
  if (startYear.slice(0, 4) === endYear.slice(0, 4)) {
    return startYear.slice(0, 4);
  }
  return `${startYear.slice(0, 4)}-${endYear.slice(0, 4)}`;
}

/*
 *  18/01/2024
 *  nb: The following functions: 'loadFirstTiff', 'extractGsd', and 'extractEpsg' are workarounds
 *  to manage the block information from being added to the collection (eo stac extension).
 *  Once this is fixed the following functions can be replaced.
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
  const itemLink = collection.links[2]?.href.replace('./', ''); // [2] to skip root & self links
  if (itemLink == null) {
    throw new Error(`No items in collection from: ${source}`);
  }
  const itemPath = fsa.join(source, itemLink);
  const item = await fsa.readJson<StacItem>(itemPath);
  if (item == null) throw new Error(`Failed to get item.json from ${itemPath}.`);
  const tiffLink = item.assets['visual']?.href.replace('./', '');
  if (tiffLink == null) {
    throw new Error(`No tiff assets in Item: ${itemPath}`);
  }
  const tiffPath = fsa.join(source, tiffLink);
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

export function extractEpsg(tiff: CogTiff): string {
  const epsg = tiff.images[0]?.epsg;
  if (!epsg) {
    throw new Error(`Missing epsg tiff tag`);
  } else if (!Epsg.Codes.has(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg}`);
  }
  return `${epsg}`;
}
