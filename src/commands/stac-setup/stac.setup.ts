import { fsa } from '@chunkd/fs';
import { command, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';
import ulid from 'ulid';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { GeospatialDataCategory, StacCollectionLinz } from '../../utils/metadata.js';
import { slugify } from '../../utils/slugify.js';
import { config, MeterAsString, registerCli, tryParseUrl, UrlFolder, urlToString, verbose } from '../common.js';

export interface SlugMetadata {
  geospatialCategory: GeospatialDataCategory;
  geographicDescription?: string;
  region: string;
  /** Optional survey ID if it exists, eg SN8066, commonly used with scanned historical imagery */
  surveyId?: string;
  date: string;
  gsd: string;
}

export const commandStacSetup = command({
  name: 'stac-setup',
  description:
    'Collection-related STAC metadata setup. Outputs collection-id and linz-slug files within /tmp/stac-setup/',
  version: CliInfo.version,
  args: {
    config,
    verbose,

    startYear: option({
      type: optional(string),
      long: 'start-year',
      description: 'Start year of survey capture',
    }),

    endYear: option({
      type: optional(string),
      long: 'end-year',
      description: 'End year of survey capture',
    }),

    gsd: option({
      type: MeterAsString,
      long: 'gsd',
      description: 'GSD of dataset, e.g. 0.3',
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

    surveyId: option({
      type: optional(string),
      long: 'survey-id',
      description: 'Associated survey id, eg SN8066 or SNC20505',
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
      if (slug !== slugify(slug)) throw new Error(`Invalid slug: ${slug}.`);

      const collectionId = collection['id'];
      await writeSetupFiles(slug, collectionId, args.output);
      logger.info({ duration: performance.now() - startTime, slug, collectionId }, 'StacSetup:Done');
    } else {
      const metadata: SlugMetadata = {
        geospatialCategory: args.geospatialCategory as GeospatialDataCategory,
        region: args.region,
        surveyId: args.surveyId,
        geographicDescription: args.geographicDescription,
        date: formatDate(args.startYear, args.endYear),
        gsd: args.gsd,
      };
      const slug = slugFromMetadata(metadata);
      const collectionId = ulid.ulid();
      await writeSetupFiles(slug, collectionId, args.output);
      logger.info({ duration: performance.now() - startTime, slug, collectionId }, 'StacSetup:Done');
    }
  },
});

function formatParts(...parts: string[]): string {
  return parts.filter((f) => f != null && f.length > 0).join('_');
}

/**
 * Generates slug based on dataset category.
 *
 * @param metadata
 * @returns slug
 */
export function slugFromMetadata(metadata: SlugMetadata): string {
  const geographicDescription = metadata.geographicDescription || metadata.region;

  switch (metadata.geospatialCategory) {
    case 'aerial-photos':
    case 'rural-aerial-photos':
    case 'satellite-imagery':
    case 'urban-aerial-photos':
      return formatParts(slugify(geographicDescription), metadata.date, `${metadata.gsd}m`);

    case 'dem':
    case 'dsm':
    case 'dem-hillshade':
    case 'dem-hillshade-igor':
      return formatParts(slugify(geographicDescription), metadata.date);

    case 'scanned-aerial-photos':
      if (metadata.surveyId == null) throw new Error('Historical imagery needs a surveyId');
      return formatParts(
        slugify(geographicDescription),
        metadata.surveyId.toLowerCase(),
        metadata.date,
        `${metadata.gsd}m`,
      );

    default:
      throw new Error(
        `Slug can't be generated from collection as no matching category: ${String(metadata.geospatialCategory)}.`,
      );
  }
}

/**
 * Format a STAC collection as a "startYear-endYear" or "startYear" in Pacific/Auckland time
 * only if both "startYear" and "endYear" are defined.
 *
 * @param startYear start capture date
 * @param endYear end capture date
 * @returns the formatted slug dates
 */
export function formatDate(startYear?: string, endYear?: string): string {
  if (startYear == null || endYear == null) return '';
  if (startYear.length === 0 || endYear.length === 0) return '';

  if (startYear === endYear) return startYear;
  return `${startYear}-${endYear}`;
}

/**
 * Write the STAC setup values to files for Argo to use
 *
 * @param slug the STAC linz:slug value to write
 * @param collectionId the STAC collection ID value to write
 * @param output the output path for the setup files
 */
export async function writeSetupFiles(slug: string, collectionId: string, output?: URL): Promise<void> {
  const slugPath = new URL('linz-slug', output);
  const collectionIdPath = new URL('collection-id', output);
  await fsa.write(urlToString(slugPath), slug);
  await fsa.write(urlToString(collectionIdPath), collectionId);
}
