import { subcommands } from 'cmd-ts';
import { commandCopy } from './copy/copy.js';
import { commandCreateManifest } from './create-manifest/create-manifest.js';
import { commandLdsFetch } from './lds-cache/lds.cache.js';
import { commandList } from './list/list.js';
import { commandStacCatalog } from './stac-catalog/stac.catalog.js';
import { commandStacLinzImagery } from './stac-linz-imagery/stac.linz.imagery.js';
import { commandStacSync } from './stac-sync/stac.sync.js';
import { commandStacValidate } from './stac-validate/stac.validate.js';
import { commandTileIndexValidate } from './tileindex-validate/tileindex.validate.js';

export const cmd = subcommands({
  name: 'argo-tasks',
  description: 'Utility tasks for argo',
  cmds: {
    copy: commandCopy,
    'create-manifest': commandCreateManifest,
    flatten: commandCreateManifest,
    'lds-fetch-layer': commandLdsFetch,
    list: commandList,
    ls: commandList,
    'stac-catalog': commandStacCatalog,
    'stac-linz-imagery': commandStacLinzImagery,
    'stac-sync': commandStacSync,
    'stac-validate': commandStacValidate,
    'tileindex-validate': commandTileIndexValidate,
  },
});
