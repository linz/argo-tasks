import { fsa } from '@chunkd/fs';
import { command, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';
import ulid from 'ulid';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { GeospatialDataCategories, StacCollectionLinz } from '../../utils/metadata.js';
import { slugify } from '../../utils/slugify.js';
import { config, registerCli, tryParseUrl, UrlFolder, urlToString, verbose } from '../common.js';

export interface SlugMetadata {
  geospatialCategory: string;
  geographicDescription?: string;
  region: string;
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
    const date = args.startYear && args.endYear ? formatDate(args.startYear, args.endYear) : '';

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
      await writeSetupFiles(slug, collectionId, args.output);
      logger.info({ duration: performance.now() - startTime, slug, collectionId }, 'StacSetup:Done');
    } else {
      const metadata: SlugMetadata = {
        geospatialCategory: args.geospatialCategory,
        region: args.region,
        geographicDescription: args.geographicDescription,
        date: date,
        gsd: args.gsd,
      };
      const slug = slugFromMetadata(metadata);
      const collectionId = ulid.ulid();
      await writeSetupFiles(slug, collectionId, args.output);
      logger.info({ duration: performance.now() - startTime, slug, collectionId }, 'StacSetup:Done');
    }
  },
});

/**
 * Generates slug based on dataset category.
 *
 * @param metadata
 * @returns slug
 */
export function slugFromMetadata(metadata: SlugMetadata): string {
  const geographicDescription = metadata.geographicDescription || metadata.region;
  const slug = slugify(metadata.date ? `${geographicDescription}_${metadata.date}` : geographicDescription);

  if (
    metadata.geospatialCategory === GeospatialDataCategories.AerialPhotos ||
    metadata.geospatialCategory === GeospatialDataCategories.RuralAerialPhotos ||
    metadata.geospatialCategory === GeospatialDataCategories.SatelliteImagery ||
    metadata.geospatialCategory === GeospatialDataCategories.UrbanAerialPhotos
  ) {
    return `${slug}_${metadata.gsd}m`;
  }
  if (
    metadata.geospatialCategory === GeospatialDataCategories.Dem ||
    metadata.geospatialCategory === GeospatialDataCategories.Dsm
  ) {
    return slug;
  }
  if (metadata.geospatialCategory === GeospatialDataCategories.ScannedAerialPhotos) {
    throw new Error(`Historic Imagery ${metadata.geospatialCategory} is out of scope for automated slug generation.`);
  }

  throw new Error(`Slug can't be generated from collection as no matching category: ${metadata.geospatialCategory}.`);
}

/**
 * Format a STAC collection as a "startYear-endYear" or "startYear" in Pacific/Auckland time
 *
 * @param startYear start capture date
 * @param endYear end capture date
 * @returns the formatted slug dates
 */
export function formatDate(startYear: string, endYear: string): string {
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
