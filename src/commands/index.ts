import { subcommands } from 'cmd-ts';

import { CliInfo } from '../cli.info.js';
import { basemapsCreatePullRequest } from './basemaps-github/create-pr.js';
import { basemapsCreateMapSheet } from './basemaps-mapsheet/create-mapsheet.js';
import { commandCopy } from './copy/copy.js';
import { commandCreateManifest } from './create-manifest/create-manifest.js';
import { commandGeneratePath } from './generate-path/path.generate.js';
import { commandGroup } from './group/group.js';
import { commandLdsFetch } from './lds-fetch-layer/lds.fetch.layer.js';
import { commandList } from './list/list.js';
import { commandMapSheetCoverage } from './mapsheet-coverage/mapsheet.coverage.js';
import { commandPrettyPrint } from './pretty-print/pretty.print.js';
import { commandStacCatalog } from './stac-catalog/stac.catalog.js';
import { commandStacGithubImport } from './stac-github-import/stac.github.import.js';
import { commandStacSetup } from './stac-setup/stac.setup.js';
import { commandStacSync } from './stac-sync/stac.sync.js';
import { commandStacValidate } from './stac-validate/stac.validate.js';
import { commandTileIndexValidate } from './tileindex-validate/tileindex.validate.js';

export const AllCommands = {
  copy: commandCopy,
  'create-manifest': commandCreateManifest,
  group: commandGroup,
  flatten: commandCreateManifest,
  'lds-fetch-layer': commandLdsFetch,
  list: commandList,
  ls: commandList,
  'mapsheet-coverage': commandMapSheetCoverage,
  'stac-catalog': commandStacCatalog,
  'stac-github-import': commandStacGithubImport,
  'stac-setup': commandStacSetup,
  'stac-sync': commandStacSync,
  'stac-validate': commandStacValidate,
  'tileindex-validate': commandTileIndexValidate,
  stac: subcommands({
    name: 'stac',
    cmds: {
      catalog: commandStacCatalog,
      'github-import': commandStacGithubImport,
      setup: commandStacSetup,
      sync: commandStacSync,
      validate: commandStacValidate,
    },
  }),
  bmc: subcommands({
    name: 'bmc',
    cmds: {
      'create-pr': basemapsCreatePullRequest,
      'create-mapsheet': basemapsCreateMapSheet,
    },
  }),
  'pretty-print': commandPrettyPrint,
  'generate-path': commandGeneratePath,
};

export const cmd = subcommands({
  name: 'argo-tasks',
  version: CliInfo.version,
  description: 'Utility tasks for argo',
  cmds: AllCommands,
});
