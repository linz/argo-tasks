import { subcommands } from 'cmd-ts';
import { commandCopy } from './copy/copy.js';
import { commandCreateManifest } from './create-manifest/create-manifest.js';
import { commandValidateFiles } from './filenames-validate/filename.validate.js';
import { commandLdsFetch } from './lds-cache/lds.cache.js';
import { commandList } from './list/list.js';
import { commandStacCatalog } from './stac-catalog/stac.catalog.js';
import { commandStacValidate } from './stac-validate/stac.validate.js';
import { commandTileSetValidate } from './tileset-validate/tileset.validate.js';

export const cmd = subcommands({
  name: 'argo-tasks',
  description: 'Utility tasks for argo',
  cmds: {
    'lds-fetch-layer': commandLdsFetch,
    ls: commandList,
    list: commandList,
    'stac-validate': commandStacValidate,
    copy: commandCopy,
    'create-manifest': commandCreateManifest,
    flatten: commandCreateManifest,
    'tileset-validate': commandTileSetValidate,
    'stac-catalog': commandStacCatalog,
    'file-validate': commandValidateFiles,
  },
});
