import { standardizeLayerName } from '@basemaps/config';
import type { ConfigLayer } from '@basemaps/config/build/config/tile.set.js';
import type { EpsgCode } from '@basemaps/geo';
import { Epsg } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { boolean, command, flag, oneOf, option, optional, string } from 'cmd-ts';
import type { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { registerCli, verbose } from '../common.ts';
import type { Category } from './make.cog.github.ts';
import { Categories, MakeCogGithub } from './make.cog.github.ts';

export const ValidTargetBuckets: Set<string> = new Set(['linz-basemaps', 'linz-basemaps-staging']);
export const ValidSourceBuckets: Set<string> = new Set(['nz-imagery', 'linz-imagery', 'nz-elevation']);

export const LinzBasemapsSourceCollectionRel = 'linz_basemaps:source_collection';

export const ConfigTypes = ['raster', 'elevation', 'vector'] as const;
export type ConfigType = (typeof ConfigTypes)[number];

export function assertValidBucket(bucket: string, validBuckets: Set<string>): void {
  // Validate the target information
  logger.info({ bucket }, 'CreatePR: Valid the target s3 bucket');
  if (!validBuckets.has(bucket)) {
    throw new Error(`Invalid s3 bucket ${bucket} from the target.`);
  }
}

export interface targetInfo {
  bucket: string;
  epsg: Epsg;
  name: string;
  filename?: string;
}

/**
 * Parse information from target url include raster, vector and elevation
 * s3://linz-basemaps/3857/canterbury_rural_2014-2015_0-30m_RGBA/01HSF04SG9M1P3V667A4NZ1MN8/
 * s3://linz-basemaps/elevation/3857/bay-of-plenty_2019-2022_dem_1m/01HSF04SG9M1P3V667A4NZ1MN8/
 * s3://linz-basemaps-staging/vector/3857/topographic/01HSF04SG9M1P3V667A4NZ1MN8/topographic.tar.co
 *
 * TODO: This should get from metadata instead of the parse string once we got the attributes in metadata
 *
 * @param target Target url to parse the information from
 * @param offset Adding index offset to exclude the `/vector/` or `/elevation/` in s3 path. 0 for raster, 1 for vector and elevation.
 */
export function parseTargetUrl(target: string, offset: 0 | 1): targetInfo {
  // Parse target bucket, epsg and imagery name from the target url
  const url = new URL(target);
  const bucket = url.hostname;
  const splits = url.pathname.split('/');
  const epsg = Epsg.tryGet(Number(splits[1 + offset]));
  const name = splits[2 + offset];

  //Validate the target information
  logger.info({ bucket }, 'CreatePR: Valid the target s3 bucket');
  if (bucket == null || !ValidTargetBuckets.has(bucket)) {
    throw new Error(`Invalid s3 bucket ${bucket} from the target ${target}.`);
  }

  if (epsg == null || name == null) throw new Error(`Invalid target ${target} to parse the epsg and imagery name.`);

  // Get filename for vector target
  if (target.endsWith('.tar.co')) {
    const filename = splits.at(-1);
    if (filename == null) throw new Error(`Invalid cotar filename for vector map ${filename}.`);
    const name = filename.replace('.tar.co', ''); // Layer name for vector map is same as the cotar filename
    return { bucket, epsg, name, filename };
  } else {
    return { bucket, epsg, name };
  }
}

/**
 * Pass Raster target location with the following format
 * s3://linz-basemaps-staging/2193/west-coast_rural_2015-16_0-3m/01F6P21PNQC7D67W5SHQF806Z3/
 * s3://linz-basemaps-staging/3857/west-coast_rural_2015-16_0-3m/01ED83TT0ZHKXTPFXEGFJHP2M5/
 */
async function parseRasterTargetInfo(
  target: string,
  individual: boolean,
): Promise<{ name: string; title: string; epsg: EpsgCode; region: string | undefined }> {
  logger.info({ target }, 'CreatePR: Get the layer information from target');
  const { bucket, epsg, name } = parseTargetUrl(target, 0);

  assertValidBucket(bucket, ValidTargetBuckets);

  const collectionPath = fsa.join(target, 'collection.json');
  const collection = await fsa.readJson<StacCollection>(collectionPath);
  if (collection == null) throw new Error(`Failed to get target collection json from ${collectionPath}.`);
  const title = collection.title;
  if (title == null) throw new Error(`Failed to get imagery title from collection.json: ${collectionPath}`);

  // Validate the source location
  const source = collection.links.find((f) => f.rel === LinzBasemapsSourceCollectionRel)?.href;
  if (source == null) throw new Error(`Failed to get source url from collection.json.`);
  const sourceUrl = new URL(source);
  const sourceBucket = sourceUrl.hostname;
  logger.info({ bucket: sourceBucket }, 'CreatePR: Validate the source s3 bucket');
  if (sourceBucket == null || !ValidSourceBuckets.has(sourceBucket)) {
    throw new Error(`Invalid s3 bucket ${sourceBucket} from the source ${sourceUrl.href}.`);
  }
  // Try to get the region for individual layers
  let region;
  if (individual) {
    logger.info({ source }, 'CreatePR: Get region for individual imagery');
    const regionValue = sourceUrl.pathname.split('/')[1];
    if (regionValue) region = regionValue;
    else {
      logger.warn({ source }, 'CreatePR: Failed to find region and use individual instead.');
      region = 'individual';
    }
  }

  return { name: standardizeLayerName(name), epsg: epsg.code, title, region };
}

/**
 * Pass vector target location with the following format
 * s3://linz-basemaps-staging/vector/3857/53382-nz-roads-addressing/01HSF04SG9M1P3V667A4NZ1MN8/53382-nz-roads-addressing.tar.co
 * s3://linz-basemaps-staging/vector/3857/topographic/01HSF04SG9M1P3V667A4NZ1MN8/topographic.tar.co
 */
async function parseVectorTargetInfo(target: string): Promise<{ name: string; title: string; epsg: EpsgCode }> {
  logger.info({ target }, 'CreatePR: Get the layer information from target');
  const { bucket, epsg, name, filename } = parseTargetUrl(target, 1);

  assertValidBucket(bucket, ValidTargetBuckets);

  if (filename == null || !filename.endsWith('.tar.co')) {
    throw new Error(`Invalid cotar filename for vector map ${filename}.`);
  }

  // Try to get the title
  const collectionPath = target.replace(filename, 'collection.json');
  const collection = await fsa.readJson<StacCollection>(collectionPath);
  if (collection == null) throw new Error(`Failed to get target collection json from ${collectionPath}.`);
  const ldsLayers = collection.links.filter((f) => f.rel === 'lds:layer');
  let title = collection.title;
  // Get title from lds:title for individual vector layer
  if (ldsLayers.length === 1) {
    const ldsTitle = ldsLayers[0]?.['lds:title'];
    if (ldsTitle != null) title = String(ldsTitle);
  }
  if (title == null) throw new Error(`Failed to get title from collection.json.`);

  return { name, epsg: epsg.code, title };
}

/**
 * Pass Elevation target location with the following format and add source location into layer
 * s3://linz-basemaps/elevation/3857/kapiti-coast_2021_dem_1m/01HZ5W74E8B1DF2B0MDSKSTSTV/
 */
async function parseElevationTargetInfo(
  target: string,
  individual: boolean,
): Promise<{ name: string; title: string; epsg: EpsgCode; region: string | undefined; source: string }> {
  logger.info({ target }, 'CreatePR: Get the layer information from target');
  const { bucket, epsg, name } = parseTargetUrl(target, 1);

  assertValidBucket(bucket, ValidTargetBuckets);

  const collectionPath = fsa.join(target, 'collection.json');
  const collection = await fsa.readJson<StacCollection>(collectionPath);
  if (collection == null) throw new Error(`Failed to get target collection json from ${collectionPath}.`);
  const title = collection.title;
  if (title == null) throw new Error(`Failed to get imagery title from collection.json.`);

  // Validate the source location
  const source = collection.links.find((f) => f.rel === 'linz_basemaps:source_collection')?.href;
  if (source == null) throw new Error(`Failed to get source url from collection.json.`);
  const sourceUrl = new URL(source);
  const sourceBucket = sourceUrl.hostname;
  assertValidBucket(sourceBucket, ValidSourceBuckets);

  // Try to get the region for individual layers
  let region;
  if (individual) {
    logger.info({ source }, 'CreatePR: Get region for individual imagery');
    const regionValue = sourceUrl.pathname.split('/')[1];
    if (regionValue) region = regionValue;
    else {
      logger.warn({ source }, 'CreatePR: Failed to find region and use individual instead.');
      region = 'individual';
    }
  }

  return {
    name, //TODO: We not standardize elevation layer name for now. And will update all others to match this in future. BM-1133
    epsg: epsg.code,
    title,
    region,
    source: source.replace('collection.json', ''),
  };
}

export const CommandCreatePRArgs = {
  verbose,
  target: option({
    type: string,
    long: 'target',
    description: 'New layers locations as array of strings import into basemaps-config',
  }),
  category: option({
    type: optional(oneOf(Object.values(Categories))),
    long: 'category',
    description: [...Object.values(Categories)].join(', '),
  }),
  repository: option({
    type: string,
    long: 'repository',
    description: 'Github repository reference',
    defaultValue: () => 'linz/basemaps-config',
    defaultValueIsSerializable: true,
  }),
  configType: option({
    type: optional(oneOf(ConfigTypes)),
    long: 'config-type',
    description: `Basemaps config file type, includes ${ConfigTypes.join(', ')}`,
    defaultValue: () => 'raster' as const,
  }),
  individual: flag({
    type: boolean,
    defaultValue: () => false,
    long: 'individual',
    description: 'Import imagery as individual layer in basemaps.',
  }),
  vector: flag({
    type: boolean,
    defaultValue: () => false,
    long: 'vector',
    description: 'To Deprecate replaced by config-type=vector',
  }),
  ticket: option({
    type: optional(string),
    long: 'ticket',
    description: 'Associated JIRA ticket e.g. AIP-74',
  }),
};

export const basemapsCreatePullRequest = command({
  name: 'bm-create-pr',
  version: CliInfo.version,
  description: 'Create a github pull request for the import imagery workflow',
  args: CommandCreatePRArgs,
  async handler(args) {
    registerCli(this, args);
    const target = args.target;
    const category: Category = args.category ?? 'New Aerial Photos';
    let targets: string[];
    try {
      targets = JSON.parse(target) as string[];
    } catch {
      throw new Error('Please provide a valid input target');
    }

    const layer: ConfigLayer = { name: '', title: '' };
    let region;
    const configType = args.vector ? 'vector' : args.configType;
    if (configType === 'vector') {
      for (const target of targets) {
        const info = await parseVectorTargetInfo(target);
        layer.name = info.name;
        layer.title = info.title;
        layer[info.epsg] = target;
      }
    } else if (configType === 'elevation') {
      for (const target of targets) {
        const info = await parseElevationTargetInfo(target, args.individual);
        layer.name = info.name;
        layer.title = info.title;
        layer[2193] = info.source;
        layer[info.epsg] = target;
        region = info.region;
      }
    } else {
      for (const target of targets) {
        const info = await parseRasterTargetInfo(target, args.individual);
        layer.name = info.name;
        layer.title = info.title;
        layer[info.epsg] = target;
        region = info.region;
      }
      layer.category = category;
    }

    if (layer.name === '' || layer.title === '') throw new Error('Failed to find the imagery name or title.');

    const git = new MakeCogGithub(layer.name, args.repository, args.ticket);
    if (configType === 'vector') {
      await git.updateVectorTileSet(layer, args.individual);
    } else if (configType === 'raster') {
      await git.updateRasterTileSet(layer, category, args.individual, region);
    } else if (configType === 'elevation') {
      await git.updateElevationTileSet(layer, args.individual, region);
    } else throw new Error(`Invalid Config File target: ${configType}`);
  },
});
