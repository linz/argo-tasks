import { fsa } from '@chunkd/fs';
import { FsAwsS3V3 } from '@chunkd/source-aws-v3';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { getFiles } from '../../utils/chunk.ts';
import { RelativeDate } from '../../utils/date.ts';
import { config, registerCli, verbose } from '../common.ts';

export const CommandListArgs = {
  config,
  verbose,
  include: option({ type: optional(string), long: 'include', description: 'Include files eg ".*.tiff?$"' }),
  exclude: option({ type: optional(string), long: 'exclude', description: 'Exclude files eg ".*.prj$"' }),
  since: option({
    type: optional(RelativeDate),
    long: 'since',
    description: 'Include files since a timestamp or relative (eg "42m" for 42 minutes)',
  }),
  until: option({
    type: optional(RelativeDate),
    long: 'until',
    description: 'Include files until a timestamp or relative (eg "42m" for 42 minutes)',
  }),

  maxItemList: option({
    type: number,
    long: 'max-items-listed',
    description: 'Maximum allowed items to be listed, -1 for unlimited',
    defaultValue() {
      return -1;
    },
  }),

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
  output: option({ type: optional(string), long: 'output', description: 'Output location for the listing' }),
  location: restPositionals({ type: string, displayName: 'location', description: 'Where to list' }),
};

export const commandList = command({
  name: 'list',
  version: CliInfo.version,
  description: 'List and group files into collections of tasks',
  args: CommandListArgs,
  async handler(args) {
    FsAwsS3V3.MaxListCount = args.maxItemList > 0 ? args.maxItemList / 1000 : args.maxItemList;
    registerCli(this, args);
    if (args.location.length === 0) {
      logger.error('List:Error:NoLocationProvided');
      process.exit(1);
    }
    const outputFiles = await getFiles(args.location, args);
    if (args.output) await fsa.write(args.output, JSON.stringify(outputFiles));
  },
});
