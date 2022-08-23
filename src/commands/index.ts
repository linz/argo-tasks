import { subcommands } from 'cmd-ts';
import { commandLdsFetch } from './lds-cache/lds.cache.js';

export const cmd = subcommands({
  name: 'argo-tasks',
  description: 'Utility tasks for argo',
  cmds: { 'lds-fetch-layer': commandLdsFetch },
});
