import { ConfigLayer, standardizeLayerName } from '@basemaps/config';
import { Epsg, EpsgCode } from '@basemaps/geo';
import { fsa, LogType } from '@basemaps/shared';
import { boolean, command, flag, oneOf, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { verbose } from '../common.js';
import { Category, MakeCogGithub, parseCategory } from './make.cog.github.js';

const validTargetBuckets: Set<string> = new Set(['linz-basemaps', 'linz-basemaps-staging']);
const validSourceBuckets: Set<string> = new Set(['nz-imagery', 'linz-imagery']);

async function parseTargetInfo(
  target: string,
  individual: boolean,
  logger: LogType,
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

  //Validate the source location
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
    description: 'Import layer into vector config in basemaps.',
  }),
};

export const basemapsCreatePullRequest = command({
  name: 'bm-create-pr',
  version: CliInfo.version,
  description: 'Create a github pull request for the import imagery workflow',
  args: CommandCreatePRArgs,
  async handler(args) {
    const target = args.target;
    const category = args.category ? parseCategory(args.category) : Category.Other;
    let targets: string[];
    try {
      targets = JSON.parse(target);
    } catch {
      throw new Error('Please provide a valid input layer');
    }

    const layer: ConfigLayer = { name: '', title: '', category };
    let region;
    for (const target of targets) {
      const info = await parseTargetInfo(target, args.individual, logger);
      layer.name = info.name;
      layer.title = info.title;
      layer[info.epsg] = target;
      region = info.region;
    }

    if (layer.name === '' || layer.title === '') throw new Error('Failed to find the imagery name or title.');

    const git = new MakeCogGithub(layer.name, args.repository);
    if (args.vector) await git.updateVectorTileSet('topographic', layer, logger);
    else await git.updateRasterTileSet('aerial', layer, category, region, logger);
  },
});
