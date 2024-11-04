import { fsa } from '@chunkd/fs';
import { command, flag, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';
import ulid from 'ulid';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { slugify } from '../../utils/slugify.js';
import { config, registerCli, tryParseUrl, UrlFolder, urlToString, verbose } from '../common.js';
import { dataCategories } from './category.constants.js';

export interface SlugMetadata {
  geospatialCategory: string;
  geographicDescription?: string;
  region: string;
  date: string;
  gsd: string;
}

export interface StacCollectionLinz {
  'linz:lifecycle': string;
  'linz:geospatial_category': string;
  'linz:region': string;
  'linz:security_classification': string;
  'linz:slug': string;
  'linz:event_name'?: string;
  'linz:geographic_description'?: string;
}

export const commandStacSetup = command({
  name: 'stac-setup',
  description: 'Setup STAC metadata for standardising workflows',
  version: CliInfo.version,
  args: {
    config,
    verbose,

    addDateInSurveyPath: flag({
      // cmd-ts has a bug where defaultValue is always false and must be overridden
      // Ref: https://github.com/Schniz/cmd-ts/issues/91
      defaultValue: () => true,
      long: 'add-date-in-survey-path',
      description: 'Include the date in the survey path',
      defaultValueIsSerializable: true,
    }),

    startDate: option({
      type: string,
      long: 'start-date',
      description: 'Start date of survey capture',
    }),

    endDate: option({
      type: string,
      long: 'end-date',
      description: 'End date of survey capture',
    }),

    gsd: option({
      type: string,
      long: 'gsd',
      description: 'GSD of dataset',
    }),

    region: option({
      type: string,
      long: 'region',
      description: 'Region of dataset',
    }),

    geographicDescription: option({
      type: string,
      long: 'geographic-description',
      description: 'Geographic description of dataset',
    }),

    geospatialCategory: option({
      type: string,
      long: 'geospatial-category',
      description: 'Geospatial category of dataset',
    }),

    odrUrl: option({
      type: optional(string),
      long: 'odr-url',
      description: 'Open Data Registry URL of existing dataset',
    }),

    output: option({
      type: optional(UrlFolder),
      long: 'output',
      description: 'Where to store output files',
      defaultValueIsSerializable: true,
      defaultValue: () => tryParseUrl('/tmp/stac-setup/'),
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();

    logger.info('StacSetup:Start');
    if (args.odrUrl) {
      const collectionPath = args.odrUrl.endsWith('collection.json')
        ? args.odrUrl
        : fsa.join(args.odrUrl, 'collection.json');
      const collection = await fsa.readJson<StacCollection & StacCollectionLinz>(collectionPath);
      if (collection == null) throw new Error(`Failed to get collection.json from ${args.odrUrl}.`);
      const slug = collection['linz:slug'];
      if (slug !== slugify(slug)) {
        throw new Error(`Invalid slug: ${slug}.`);
      }
      const collectionId = collection['id'];
      await writeSetupFiles(startTime, slug, collectionId, args.output);
    } else {
      const metadata: SlugMetadata = {
        geospatialCategory: args.geospatialCategory,
        region: args.region,
        geographicDescription: args.geographicDescription,
        date: args.addDateInSurveyPath ? formatDate(args.startDate, args.endDate) : '',
        gsd: args.gsd,
      };
      const slug = generateSlug(metadata);
      const collectionId = ulid.ulid();
      await writeSetupFiles(startTime, slug, collectionId, args.output);
    }
  },
});

/**
 * Generates slug based on dataset category.
 *
 * @param metadata
 * @returns slug
 */
export function generateSlug(metadata: SlugMetadata): string {
  const geographicDescription = metadata.geographicDescription || metadata.region;
  const slug = slugify(metadata.date ? `${geographicDescription}_${metadata.date}` : geographicDescription);

  if (
    [
      dataCategories.AERIAL_PHOTOS,
      dataCategories.RURAL_AERIAL_PHOTOS,
      dataCategories.SATELLITE_IMAGERY,
      dataCategories.URBAN_AERIAL_PHOTOS,
    ].includes(metadata.geospatialCategory)
  ) {
    return `${slug}_${metadata.gsd}m`;
  }
  if ([dataCategories.DEM, dataCategories.DSM].includes(metadata.geospatialCategory)) {
    return `${slug}`;
  }
  if (metadata.geospatialCategory === dataCategories.SCANNED_AERIAL_PHOTOS) {
    // nb: Historic Imagery is out of scope as survey number is not yet recorded in collection metadata
    throw new Error(`Automated slug generation not implemented for historic imagery`);
  }
  throw new Error(`Slug Can't be generated from collection as no matching category: ${metadata.geospatialCategory}.`);
}

/**
 * Format a STAC collection as a "startYear-endYear" or "startYear" in Pacific/Auckland time
 *
 * @param startDate start capture date
 * @param endDate end capture date
 * @returns the formatted slug dates
 */
export function formatDate(startDate: string, endDate: string): string {
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);

  if (startYear == null || endYear == null) throw new Error(`Missing datetime field`);
  if (startYear === endYear) return startYear;
  return `${startYear}-${endYear}`;
}

/**
 * Write the STAC setup values to files for Argo to use
 *
 * @param startTime start time for logging information
 * @param slug the STAC linz:slug value to write
 * @param collectionId the STAC collection ID value to write
 * @param output the output path for the setup files
 */
export async function writeSetupFiles(
  startTime: number,
  slug: string,
  collectionId: string,
  output?: URL,
): Promise<void> {
  const slugPath = new URL('linz-slug', output);
  const collectionIdPath = new URL('collection-id', output);
  await fsa.write(urlToString(slugPath), slug);
  await fsa.write(urlToString(collectionIdPath), collectionId);
  logger.info({ duration: performance.now() - startTime, slug, collectionId }, 'StacSetup:Done');
}
