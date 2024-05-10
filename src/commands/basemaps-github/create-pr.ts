import { standardizeLayerName } from '@basemaps/config';
import { ConfigLayer } from '@basemaps/config/build/config/tile.set.js';
import { Epsg, EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { boolean, command, flag, oneOf, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { registerCli, verbose } from '../common.js';
import { Category, MakeCogGithub } from './make.cog.github.js';

const validTargetBuckets: Set<string> = new Set(['linz-basemaps', 'linz-basemaps-staging']);
const validSourceBuckets: Set<string> = new Set(['nz-imagery', 'linz-imagery']);

export enum ConfigType {
  Raster = 'raster',
  Vector = 'vector',
  Elevation = 'elevation',
}

function assertValidBucket(bucket: string, validBuckets: Set<string>): void {
  // Validate the target information
  logger.info({ bucket }, 'CreatePR: Valid the target s3 bucket');
  if (!validBuckets.has(bucket)) {
    throw new Error(`Invalid s3 bucket ${bucket} from the target.`);
  }
}

async function parseRasterTargetInfo(
  target: string,
  individual: boolean,
): Promise<{ name: string; title: string; epsg: EpsgCode; region: string | undefined }> {
  logger.info({ target }, 'CreatePR: Get the layer information from target');
  const url = new URL(target);
  const bucket = url.hostname;
  const splits = url.pathname.split('/');
  const epsg = Epsg.tryGet(Number(splits[1]));
  const name = splits[2];

  assertValidBucket(bucket, validTargetBuckets);

  if (epsg == null || name == null) throw new Error(`Invalid target ${target} to parse the epsg and imagery name.`);
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
  assertValidBucket(sourceBucket, validSourceBuckets);

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
  const url = new URL(target);
  const bucket = url.hostname;
  const splits = url.pathname.split('/');
  const epsg = Epsg.tryGet(Number(splits[2]));
  const name = splits[3];

  assertValidBucket(bucket, validTargetBuckets);

  if (epsg == null || name == null) throw new Error(`Invalid target ${target} to parse the epsg and imagery name.`);
  if (epsg !== Epsg.Google) throw new Error(`Unsupported epsg code ${epsg.code} for vector map.`);
  // Try to get the title
  const collectionPath = fsa.join(target, 'collection.json');
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

  return { name: name, epsg: epsg.code, title };
}

export const CommandCreatePRArgs = {
  verbose,
  target: option({
    type: string,
    long: 'target',
    description: 'New layers locations as array of strings import into basemaps-config',
  }),
  category: option({
    type: optional(oneOf(Object.values(Category))),
    long: 'category',
    description: [...Object.values(Category)].join(', '),
  }),
  repository: option({
    type: string,
    long: 'repository',
    description: 'Github repository reference',
    defaultValue: () => 'linz/basemaps-config',
    defaultValueIsSerializable: true,
  }),
  configType: option({
    type: optional(oneOf(Object.values(ConfigType))),
    long: 'config-type',
    description: `Basemaps config file type, includes ${[...Object.values(ConfigType)].join(', ')}`,
    defaultValue: () => ConfigType.Raster,
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
    const category = args.category ?? Category.Other;
    let targets: string[];
    try {
      targets = JSON.parse(target);
    } catch {
      throw new Error('Please provide a valid input target');
    }

    const layer: ConfigLayer = { name: '', title: '' };
    let region;
    const configType = args.vector ? ConfigType.Vector : args.configType;
    if (configType === ConfigType.Vector) {
      for (const target of targets) {
        const info = await parseVectorTargetInfo(target);
        layer.name = info.name;
        layer.title = info.title;
        layer[info.epsg] = target;
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
    if (configType === ConfigType.Vector) {
      await git.updateVectorTileSet(layer.name, layer, args.individual);
    } else if (configType === ConfigType.Raster) {
      await git.updateRasterTileSet(layer.name, layer, category, args.individual, region);
    } else if (configType === ConfigType.Elevation) {
      await git.updateElevationTileSet(layer.name, layer, category, args.individual, region);
    } else throw new Error(`Invalid Config File target: ${configType}`);
  },
});
