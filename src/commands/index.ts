import { subcommands } from 'cmd-ts';
import { commandCopy } from './copy/copy.js';
import { commandFlatten } from './flatten/flatten.js';
import { commandLdsFetch } from './lds-cache/lds.cache.js';
import { commandList } from './list/list.js';

export const cmd = subcommands({
  name: 'argo-tasks',
  description: 'Utility tasks for argo',
  cmds: {
    'lds-fetch-layer': commandLdsFetch,
    ls: commandList,
    list: commandList,
    copy: commandCopy,
    flatten: commandFlatten,
  },
});
