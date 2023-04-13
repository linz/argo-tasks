import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';
import { getFiles } from '../../utils/chunk.js';
import { config, registerCli, verbose } from '../common.js';
import { logger } from '../../log.js';

export const commandList = command({
  name: 'list',
  description: 'List and group files into collections of tasks',
  args: {
    config,
    verbose,
    include: option({ type: optional(string), long: 'include', description: 'Include files eg ".*.tiff?$"' }),
    exclude: option({ type: optional(string), long: 'exclude', description: 'Exclude files eg ".*.prj$"' }),
    groupSize: option({
      type: optional(string),
      long: 'group-size',
      description: 'Group files into this size per group, eg "5Gi" or "3TB"',
    }),
    group: option({ type: optional(number), long: 'group', description: 'Group files into this number per group' }),
    limit: option({
      type: optional(number),
      long: 'limit',
      description: 'Limit the file count to this amount, -1 is no limit',
    }),
    output: option({ type: string, long: 'output', description: 'Output location for the listing' }),
    location: restPositionals({ type: string, displayName: 'location', description: 'Where to list' }),
  },
  handler: async (args) => {
    registerCli(args);
    if (args.location.length === 0) {
      logger.error('List:Error:NoLocationProvided');
      process.exit(1);
    }
    const outputFiles = await getFiles(args.location, args);
    await fsa.write(args.output, JSON.stringify(outputFiles));
  },
});
