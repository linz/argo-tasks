import { boolean, command, flag, oneOf, option, optional, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { verbose } from '../common.js';
import { CliInfo } from '../../cli.info.js';
import { Category, MakeCogGithub, parseCategory } from './make.cog.github.js';
import { ConfigLayer, standardizeLayerName } from '@basemaps/config';

export const CommandCreatePRArgs = {
  verbose,
  layer: option({
    type: string,
    long: 'layer',
    description: 'Input config layer import into basemaps-config',
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
    const layerStr = args.layer;
    const category = args.category ? parseCategory(args.category) : Category.Other;
    let layer: ConfigLayer;
    try {
      layer = JSON.parse(layerStr);
    } catch {
      throw new Error('Please provide a valid input layer');
    }

    //Make sure the imagery name is standardized before update the config
    layer.name = standardizeLayerName(layer.name);

    const git = new MakeCogGithub(layer.name, args.repository, logger);
    if (args.vector) await git.updateVectorTileSet('topographic', layer);
    else await git.updateRasterTileSet('aerial', layer, category, args.individual);
  },
});
