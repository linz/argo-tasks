import { subcommands } from 'cmd-ts';

import { CliInfo } from "../cli.info.ts";
import { basemapsCreatePullRequest } from "./basemaps-github/create-pr.ts";
import { basemapsCreateMapSheet } from "./basemaps-mapsheet/create-mapsheet.ts";
import { commandCopy } from "./copy/copy.ts";
import { commandCreateManifest } from "./create-manifest/create-manifest.ts";
import { commandGeneratePath } from "./generate-path/path.generate.ts";
import { commandGroup } from "./group/group.ts";
import { commandLdsFetch } from "./lds-fetch-layer/lds.fetch.layer.ts";
import { commandList } from "./list/list.ts";
import { commandMapSheetCoverage } from "./mapsheet-coverage/mapsheet.coverage.ts";
import { commandPrettyPrint } from "./pretty-print/pretty.print.ts";
import { commandStacCatalog } from "./stac-catalog/stac.catalog.ts";
import { commandStacGithubImport } from "./stac-github-import/stac.github.import.ts";
import { commandStacSetup } from "./stac-setup/stac.setup.ts";
import { commandStacSync } from "./stac-sync/stac.sync.ts";
import { commandStacValidate } from "./stac-validate/stac.validate.ts";
import { commandTileIndexValidate } from "./tileindex-validate/tileindex.validate.ts";

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
