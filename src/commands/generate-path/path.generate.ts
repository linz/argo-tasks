import { Epsg } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import type { Tiff } from '@cogeotiff/core';
import { command, option, positional, string } from 'cmd-ts';
import type { StacCollection, StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import type { StacCollectionLinz } from '../../utils/metadata.ts';
import { GeospatialDataCategories } from '../../utils/metadata.ts';
import { config, createTiff, registerCli, UrlFolder, verbose } from '../common.ts';

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
      type: UrlFolder,
      displayName: 'path',
      description: 'path to source data where collection.json file is located',
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();

    logger.info({ source: protocolAwareString(args.source) }, 'GeneratePath:Start');

    const collection = await fsa.readJson<StacCollection & StacCollectionLinz>(new URL('collection.json', args.source));
    if (collection == null) throw new Error(`Failed to get collection.json from ${protocolAwareString(args.source)}.`);

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
    logger.info({ duration: performance.now() - startTime, target }, 'GeneratePath:Done');

    await fsa.write(fsa.toUrl('/tmp/generate-path/target'), target);
    logger.info({ location: '/tmp/generate-path/target', target }, 'GeneratePath:Written');
  },
});

/**
 * Generates target path based on dataset category.
 *
 * @param metadata
 * @returns
 */
export function generatePath(metadata: PathMetadata): string {
  if (
    metadata.geospatialCategory === GeospatialDataCategories.UrbanAerialPhotos ||
    metadata.geospatialCategory === GeospatialDataCategories.RuralAerialPhotos ||
    metadata.geospatialCategory === GeospatialDataCategories.SatelliteImagery ||
    metadata.geospatialCategory === GeospatialDataCategories.ScannedAerialPhotos
  ) {
    return `s3://${metadata.targetBucketName}/${metadata.region}/${metadata.slug}/rgb/${metadata.epsg}/`;
  }

  if (
    metadata.geospatialCategory === GeospatialDataCategories.Dem ||
    metadata.geospatialCategory === GeospatialDataCategories.Dsm ||
    metadata.geospatialCategory === GeospatialDataCategories.DemHillshade ||
    metadata.geospatialCategory === GeospatialDataCategories.DemHillshadeIgor ||
    metadata.geospatialCategory === GeospatialDataCategories.DsmHillshade ||
    metadata.geospatialCategory === GeospatialDataCategories.DsmHillshadeIgor
  ) {
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
export async function loadFirstTiff(source: URL, collection: StacCollection): Promise<Tiff> {
  const itemLink = collection.links.find((f) => f.rel === 'item')?.href;
  if (itemLink == null) throw new Error(`No items in collection from ${protocolAwareString(source)}.`);

  const itemLocation = new URL(itemLink, source);
  const item = await fsa.readJson<StacItem>(itemLocation);
  if (item == null) throw new Error(`Failed to get item.json from ${protocolAwareString(itemLocation)}.`);

  const tiffLink = item.assets['visual']?.href;
  if (tiffLink == null) throw new Error(`No tiff assets in Item: ${protocolAwareString(itemLocation)}`);

  const tiffLocation = new URL(tiffLink, source);
  const tiff = await createTiff(tiffLocation);
  if (tiff == null) throw new Error(`Failed to get tiff from ${protocolAwareString(tiffLocation)}.`);
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
  if (gsd == null) throw new Error(`Missing resolution tiff tag: ${protocolAwareString(tiff.source.url)}`);
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
    throw new Error(`Missing epsg tiff tag: ${protocolAwareString(tiff.source.url)}`);
  } else if (!Epsg.Codes.has(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg} on tiff: ${protocolAwareString(tiff.source.url)}`);
  }
  return epsg;
}
