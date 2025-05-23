import { fsa } from '@chunkd/fs';
import { command, flag, number, option, optional, restPositionals, string } from 'cmd-ts';
import { createHash } from 'crypto';
import path from 'path';
import { gzipSync } from 'zlib';

import { CliInfo } from '../../cli.info.ts';
import { getActionLocation } from '../../utils/action.storage.ts';
import type { ActionCopy } from '../../utils/actions.ts';
import type { FileFilter } from '../../utils/chunk.ts';
import { getFiles } from '../../utils/chunk.ts';
import { config, registerCli, verbose } from '../common.ts';

export const commandCreateManifest = command({
  name: 'create-manifest',
  description: 'Create a list of files to copy and pass as a manifest',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    flatten: flag({ long: 'flatten', description: 'Flatten the files in the target location' }),
    transform: option({ type: optional(string), long: 'transform', description: 'Transform/rename files' }),
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
  async handler(args) {
    registerCli(this, args);

    const outputCopy: string[] = [];

    const targetPath: string = args.target;
    const actionLocation = getActionLocation();
    for (const source of args.source) {
      const outputFiles = await createManifest(source, targetPath, args);
      for (const current of outputFiles) {
        const outBuf = Buffer.from(JSON.stringify(current));
        const targetHash = createHash('sha256').update(outBuf).digest('base64url');

        // Store the list of files to move in a bucket rather than the ARGO parameters
        if (actionLocation) {
          const targetLocation = fsa.join(actionLocation, `actions/manifest-${targetHash}.json`);
          const targetAction: ActionCopy = { action: 'copy', parameters: { manifest: current } };
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

export type SourceTarget = { source: string; target: string };
export type ManifestFilter = FileFilter & { flatten: boolean; transform?: string };

function createTransformFunc(transform: string): (f: string) => string {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  if (transform.startsWith('return')) return new Function('f', transform) as (f: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('f', 'return ' + transform) as (f: string) => string;
}

export async function createManifest(
  source: string,
  targetPath: string,
  args: ManifestFilter,
): Promise<SourceTarget[][]> {
  const outputFiles = await getFiles([source], args);
  const outputCopy: SourceTarget[][] = [];

  const transformFunc = args.transform ? createTransformFunc(args.transform) : null;

  for (const chunk of outputFiles) {
    const current: SourceTarget[] = [];

    for (const filePath of chunk) {
      const baseFile = args.flatten ? path.basename(filePath) : filePath.slice(source.length);
      let target = targetPath;
      if (baseFile) {
        target = fsa.joinAll(targetPath, transformFunc ? transformFunc(baseFile) : baseFile);
      }
      validatePaths(filePath, target);
      current.push({ source: filePath, target });
    }
    outputCopy.push(current);
  }

  return outputCopy;
}

export function validatePaths(source: string, target: string): void {
  // Throws error if the source and target paths are not:
  // - both directories
  // - both paths
  if (source.endsWith('/') && target.endsWith('/')) {
    return;
  }
  if (!source.endsWith('/') && !target.endsWith('/')) {
    return;
  }
  throw new Error(`Path Mismatch - source: ${source}, target: ${target}`);
}
