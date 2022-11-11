import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';
import { createHash } from 'crypto';
import path from 'path';
import { gzipSync } from 'zlib';
import { getArgoLocation } from '../../utils/argo.js';
import { getFiles } from '../../utils/chunk.js';
import { S3ActionCopy } from '../../utils/s3.action.js';
import { config, registerCli, verbose } from '../common.js';

export const commandCreateManifest = command({
  name: 'create-manifest',
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
    target: option({ type: string, long: 'target', description: 'Copy destination' }),
    source: restPositionals({ type: string, displayName: 'source', description: 'Where to list' }),
  },
  handler: async (args) => {
    registerCli(args);
    const argoLocation = getArgoLocation();

    const outputCopy: string[] = [];

    const targetPath: string = args.target;

    for (const source of args.source) {
      const outputFiles = await getFiles([source], args);

      for (const chunk of outputFiles) {
        const current: { source: string; target: string }[] = [];

        for (const filePath of chunk) {
          const baseFile = path.basename(filePath);
          const target = fsa.joinAll(targetPath, baseFile);
          current.push({ source: filePath, target });
        }

        const outBuf = Buffer.from(JSON.stringify(current));
        const targetHash = createHash('sha256').update(outBuf).digest('base64url');

        // If running inside of ARGO store the list of files to move in a S3 bucket rather than the ARGO parameters
        if (argoLocation) {
          const targetLocation = fsa.join(argoLocation, `actions/copy-manifest-${targetHash}.json`);
          const targetAction: S3ActionCopy = { action: 'copy', parameters: { manifest: current } };
          await fsa.write(targetLocation, JSON.stringify(targetAction));
          outputCopy.push(targetLocation);
        } else {
          outputCopy.push(gzipSync(outBuf).toString('base64url'));
        }
      }
    }

    await fsa.write(args.output, JSON.stringify(outputCopy));
  },
});
