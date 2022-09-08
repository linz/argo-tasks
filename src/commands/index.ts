import { subcommands } from 'cmd-ts';
import { commandLdsFetch } from './lds-cache/lds.cache.js';
import { commandList } from './list/list.js';
import { commandStacValidate } from './stac-validate/stac.validate.js';

export const cmd = subcommands({
  name: 'argo-tasks',
  description: 'Utility tasks for argo',
  cmds: {
    'lds-fetch-layer': commandLdsFetch,
    ls: commandList,
    list: commandList,
    'stac-validate': commandStacValidate,
  },
});
