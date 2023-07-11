import { subcommands } from 'cmd-ts';
import { commandCopy } from './copy/copy.js';
import { commandCreateManifest } from './create-manifest/create-manifest.js';
import { commandLdsFetch } from './lds-cache/lds.cache.js';
import { commandList } from './list/list.js';
import { commandStacCatalog } from './stac-catalog/stac.catalog.js';
import { commandStacSync } from './stac-sync/stac.sync.js';
import { commandStacValidate } from './stac-validate/stac.validate.js';
import { commandTileIndexValidate } from './tileindex-validate/tileindex.validate.js';
import { commandStacGithubImport } from './stac-github-import/stac.github.import.js';
import { commandGroup } from './group/group.js';
import { CliInfo } from '../cli.info.js';

export const cmd = subcommands({
  name: 'argo-tasks',
  version: CliInfo.version,
  description: 'Utility tasks for argo',
  cmds: {
    copy: commandCopy,
    'create-manifest': commandCreateManifest,
    group: commandGroup,
    flatten: commandCreateManifest,
    'lds-fetch-layer': commandLdsFetch,
    list: commandList,
    ls: commandList,
    'stac-catalog': commandStacCatalog,
    'stac-github-import': commandStacGithubImport,
    'stac-sync': commandStacSync,
    'stac-validate': commandStacValidate,
    'tileindex-validate': commandTileIndexValidate,
    stac: subcommands({
      name: 'stac',
      cmds: {
        catalog: commandStacCatalog,
        'github-import': commandStacGithubImport,
        sync: commandStacSync,
        validate: commandStacValidate,
      },
    }),
  },
});
