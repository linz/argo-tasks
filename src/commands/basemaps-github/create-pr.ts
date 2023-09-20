import { ConfigLayer, standardizeLayerName } from '@basemaps/config';
import { Epsg, EpsgCode } from '@basemaps/geo';
import { fsa } from '@basemaps/shared';
import { boolean, command, flag, oneOf, option, optional, string } from 'cmd-ts';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { verbose } from '../common.js';
import { Category, MakeCogGithub, parseCategory } from './make.cog.github.js';

async function parseTargetInfo(target: string): Promise<{ name: string; title: string; epsg: EpsgCode }> {
  const splits = target.replace('s3://', '').split('/');
  const epsg = Epsg.tryGet(Number(splits[1]));
  const name = splits[2];
  if (epsg == null || name == null) throw new Error(`Invalid target ${target} to parse the epsg and imagery name.`);
  const collectionPath = fsa.join(target, 'collection.json');
  const collection = await fsa.readJson<StacCollection>(collectionPath);
  const title = collection.title;
  if (title == null) throw new Error(`Failed to get imagery title from collection.json.`);

  return { name: standardizeLayerName(name), epsg: epsg.code, title };
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
    for (const target of targets) {
      const info = await parseTargetInfo(target);
      layer.name = info.name;
      layer.title = info.title;
      layer[info.epsg] = target;
    }

    if (layer.name === '' || layer.title === '') throw new Error('Failed to find the imagery name or title.');

    const git = new MakeCogGithub(layer.name, args.repository);
    if (args.vector) await git.updateVectorTileSet('topographic', layer, logger);
    else await git.updateRasterTileSet('aerial', layer, category, args.individual, logger);
  },
});
