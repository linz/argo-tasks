import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';
import path from 'path';
import { gzipSync } from 'zlib';
import { getFiles } from '../../utils/chunk.js';
import { config, registerCli, verbose } from '../common.js';

export const commandFlatten = command({
  name: 'flatten',
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
    group: option({
      type: optional(number),
      long: 'group',
      description: 'Group files into this number per group',
      defaultValue: () => 1000,
    }),
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

    const outputCopy: string[] = [];

    for (const location of args.location) {
      const outputFiles = await getFiles([location], args);

      for (const chunk of outputFiles) {
        const current: { source: string; target: string }[] = [];

        for (const filePath of chunk) {
          const baseFile = path.basename(filePath);
          const target = fsa.joinAll(location, 'flat', baseFile);
          current.push({ source: filePath, target });
        }

        const outBuf = Buffer.from(JSON.stringify(current));
        outputCopy.push(gzipSync(outBuf).toString('base64url'));
      }
    }

    await fsa.write(args.output, JSON.stringify(outputCopy));
  },
});
