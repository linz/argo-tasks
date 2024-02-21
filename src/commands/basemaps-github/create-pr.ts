import { ConfigLayer, standardizeLayerName } from '@basemaps/config';
import { Epsg, EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { command, oneOf, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { registerCli, verbose } from '../common.js';
import { Category, MakeCogGithub, parseCategory } from './make.cog.github.js';

const validTargetBuckets: Set<string> = new Set(['linz-basemaps', 'linz-basemaps-staging']);
const validSourceBuckets: Set<string> = new Set(['nz-imagery', 'linz-imagery']);

enum ConfigFile {
  Individual = 'individual',
  Aerial = 'aerial',
  Vector = 'topographic',
  Elevation = 'elevation',
}

async function parseTargetInfo(
  target: string,
  configFile: ConfigFile | undefined,
): Promise<{ name: string; title: string; epsg: EpsgCode; region: string | undefined }> {
  logger.info({ target }, 'CreatePR: Get the layer information from target');
  const url = new URL(target);
  const bucket = url.hostname;
  const splits = url.pathname.split('/');
  const epsg = Epsg.tryGet(Number(splits[1]));
  const name = splits[2];

  //Validate the target information
  logger.info({ bucket }, 'CreatePR: Valid the target s3 bucket');
  if (bucket == null || !validTargetBuckets.has(bucket)) {
    throw new Error(`Invalid s3 bucket ${bucket} from the target ${target}.`);
  }

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
  logger.info({ bucket: sourceBucket }, 'CreatePR: Validate the source s3 bucket');
  if (sourceBucket == null || !validSourceBuckets.has(sourceBucket)) {
    throw new Error(`Invalid s3 bucket ${sourceBucket} from the source ${sourceUrl}.`);
  }
  // Try to get the region for individual layers
  let region;
  if (configFile === ConfigFile.Individual) {
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
  configFile: option({
    type: optional(oneOf(Object.values(ConfigFile))),
    long: 'config-file',
    description: [...Object.values(Category)].join(', '),
    defaultValue: () => ConfigFile.Aerial,
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
    const category = args.category ? parseCategory(args.category) : Category.Other;
    let targets: string[];
    try {
      targets = JSON.parse(target);
    } catch {
      throw new Error('Please provide a valid input target');
    }

    const layer: ConfigLayer = { name: '', title: '' };
    let region;
    if (args.configFile === ConfigFile.Vector) {
      layer.name = 'topographic';
      layer.title = 'Topographic';
      layer[3857] = targets[0];
    } else {
      for (const target of targets) {
        const info = await parseTargetInfo(target, args.configFile);
        layer.name = info.name;
        layer.title = info.title;
        layer[info.epsg] = target;
        region = info.region;
      }
      layer.category = category;
    }
    if(region == null) region=ConfigFile.Individual;

    if (layer.name === '' || layer.title === '') throw new Error('Failed to find the imagery name or title.');

    const git = new MakeCogGithub(layer.name, args.repository);
    if (args.configFile === ConfigFile.Vector) await git.updateVectorTileSet(ConfigFile.Vector, layer);
    else if (args.configFile === ConfigFile.Aerial) await git.updateAerialTileSet(ConfigFile.Aerial, layer, category);
    else if (args.configFile === ConfigFile.Elevation) await git.updateElevationTileSet(ConfigFile.Elevation, layer);
    else if (args.configFile === ConfigFile.Individual)
      await git.updateIndividualTileSet(region, layer, category);
    else throw new Error(`Invalid Config File target: ${args.configFile}`);
  },
});
