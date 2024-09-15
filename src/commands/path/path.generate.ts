import { Epsg } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { Tiff } from '@cogeotiff/core';
import { boolean, command, flag, option, positional, string } from 'cmd-ts';
import { StacCollection, StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { slugify } from '../../utils/slugify.js';
import { config, createTiff, registerCli, verbose } from '../common.js';
import { dataCategories } from './path.constants.js';

export interface PathMetadata {
  targetBucketName: string;
  category: string;
  geographicDescription?: string;
  region: string;
  date: string;
  gsd: number;
  epsg: number;
}

export interface StacCollectionLinz {
  'linz:lifecycle': string;
  'linz:geospatial_category': string;
  'linz:region': string;
  'linz:security_classification': string;
  'linz:event_name'?: string;
  'linz:geographic_description'?: string;
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

    ignoreDate: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'ignore-date',
      description: 'Do not include the date in the survey name',
      defaultValueIsSerializable: true,
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
      category: collection['linz:geospatial_category'],
      region: collection['linz:region'],
      geographicDescription: collection['linz:geographic_description'],
      date: args.ignoreDate ? '' : formatDate(collection),
      gsd: extractGsd(tiff),
      epsg: extractEpsg(tiff),
    };

    const target = generatePath(metadata);
    logger.info({ duration: performance.now() - startTime, target: target }, 'GeneratePath:Done');

    if (isArgo()) {
      // Path to where the target is located
      await fsa.write('/tmp/generate-path/target', target);
      logger.info({ location: '/tmp/generate-path/target', target: target }, 'GeneratePath:Written');
    }
  },
});

/**
 *Generates target path based on dataset category.
 *
 * @param {PathMetadata} metadata
 * @returns {string}
 */
export function generatePath(metadata: PathMetadata): string {
  const name = formatName(metadata.region, metadata.geographicDescription);
  const surveyName = metadata.date ? `${name}_${metadata.date}` : name;

  if (metadata.category === dataCategories.SCANNED_AERIAL_PHOTOS) {
    // nb: Historic Imagery is out of scope as survey number is not yet recorded in collection metadata
    throw new Error(`Automated target generation not implemented for historic imagery`);
  } else if ([dataCategories.URBAN_AERIAL_PHOTOS, dataCategories.RURAL_AERIAL_PHOTOS].includes(metadata.category)) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${surveyName}_${metadata.gsd}m/rgb/${metadata.epsg}/`;
  } else if (metadata.category === dataCategories.SATELLITE_IMAGERY) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${surveyName}_${metadata.gsd}m/rgb/${metadata.epsg}/`;
  } else if ([dataCategories.DEM, dataCategories.DSM].includes(metadata.category)) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${surveyName}/${metadata.category}_${metadata.gsd}m/${metadata.epsg}/`;
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
 * @export
 * @param {string} region
 * @param {?string} [geographicDescription]
 * @returns {string}
 */
export function formatName(region: string, geographicDescription?: string): string {
  if (geographicDescription) {
    return slugify(geographicDescription);
  }
  return slugify(region);
}

export function formatDate(collection: StacCollection): string {
  const interval = collection.extent?.temporal?.interval?.[0];
  const startYear = getPacificAucklandYear(interval[0]);
  const endYear = getPacificAucklandYear(interval[1]);

  if (startYear == null || endYear == null) {
    throw new Error(`Missing datetime in interval: ${interval.join(', ')}`);
  }
  if (startYear === endYear) {
    return startYear;
  }
  return `${startYear}-${endYear}`;
}

/**
 * Convert time zone-aware date/time string to Pacific/Auckland time zone string
 *
 * We can't convert the time zone of a `Date` directly, but instead have to produce a localised
 * date/time string. We arbitrarily convert to the New Zealand English format (For example,
 * '2/04/2024, 11:27:30 am'), since it doesn't seem to be possible to convert directly to a more
 * easily parsed format like ISO 8601 or RFC 3339.
 *
 * @param {string | null} dateTimeString Optional date/time string which can be parsed by the `Date` constructor
 * @returns {string | undefined} Localised date/time string
 *
 */
function getPacificAucklandYear(dateTimeString: string | null): string | undefined {
  if (dateTimeString == null) {
    return undefined;
  }

  const pacificAucklandDateTimeString = new Date(dateTimeString).toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland',
  });
  return pacificAucklandDateTimeString.split(/[,/]/, 4)[2];
}

/*
 *  nb: The following functions: 'loadFirstTiff', 'extractGsd', and 'extractEpsg' are
 *  workarounds for use until the eo stac extension is added to the collection.json.
 */

/**
 * Gets tiff of first item listed in collection
 *
 * @async
 * @param {string} source
 * @param {StacCollection} collection
 * @returns {Promise<Tiff>}
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

export function extractGsd(tiff: Tiff): number {
  const gsd = tiff.images[0]?.resolution[0];
  if (gsd == null) {
    throw new Error(`Missing resolution tiff tag: ${tiff.source.url.href}`);
  }
  return gsd;
}

export function extractEpsg(tiff: Tiff): number {
  const epsg = tiff.images[0]?.epsg;
  if (epsg == null) {
    throw new Error(`Missing epsg tiff tag: ${tiff.source.url.href}`);
  } else if (!Epsg.Codes.has(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg} on tiff: ${tiff.source.url.href}`);
  }
  return epsg;
}
