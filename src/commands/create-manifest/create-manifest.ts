import { fsa } from '@chunkd/fs';
import { command, flag, number, option, optional, restPositionals, string } from 'cmd-ts';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';

import type { CommandArguments } from '../../__test__/type.util.ts';
import { CliInfo } from '../../cli.info.ts';
import { getActionLocation } from '../../utils/action.storage.ts';
import type { ActionCopy } from '../../utils/actions.ts';
import type { FileFilter } from '../../utils/chunk.ts';
import { getFiles } from '../../utils/chunk.ts';
import { makeRelative, protocolAwareString } from '../../utils/filelist.ts';
import { config, registerCli, Url, UrlFolder, UrlFolderList, verbose } from '../common.ts';

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
    output: option({ type: Url, long: 'output', description: 'Output location for the listing' }),
    target: option({ type: UrlFolder, long: 'target', description: 'Copy destination' }),
    source: restPositionals({ type: UrlFolderList, displayName: 'source', description: 'Where to list' }),
  },
  async handler(args) {
    registerCli(this, args);

    const outputCopy: string[] = [];

    const targetLocation = args.target;
    const actionLocation = getActionLocation();
    const outputFiles = await createManifest(args.source.flat(), targetLocation, args);
    for (const current of outputFiles) {
      const outBuf = Buffer.from(JSON.stringify(current));
      const targetHash = createHash('sha256').update(outBuf).digest('base64url');

      // Store the list of files to move in a bucket rather than the ARGO parameters
      if (actionLocation) {
        const targetLocation = new URL(`actions/manifest-${targetHash}.json`, actionLocation);
        const targetAction: ActionCopy = { action: 'copy', parameters: { manifest: current } };
        await fsa.write(targetLocation, JSON.stringify(targetAction));
        outputCopy.push(protocolAwareString(targetLocation));
      } else {
        outputCopy.push(gzipSync(outBuf).toString('base64url'));
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
  sources: URL[],
  targetLocation: URL,
  args: ManifestFilter,
): Promise<SourceTarget[][]> {
  const outputFiles = await getFiles(sources, args);
  const outputCopy: SourceTarget[][] = [];

  const transformFunc = args.transform ? createTransformFunc(args.transform) : null;

  for (const outputChunks of outputFiles) {
    const current: SourceTarget[] = [];
    for (const filePath of outputChunks) {
      const sourceRoot = sources.find((src) => filePath.href.startsWith(src.href));
      if (!sourceRoot) {
        const sourcesList = sources.map((s) => s.href).join(', ');
        throw new Error(`Source root not found for file: ${filePath.href} in sources: ${sourcesList}`);
      }
      const baseFile = args.flatten
        ? filePath.pathname.split('/').slice(-1).join('/') // file name only
        : makeRelative(sourceRoot, filePath);
      const target = new URL(transformFunc ? transformFunc(baseFile) : baseFile, targetLocation);

      validatePaths(filePath, target);
      current.push({ source: protocolAwareString(filePath), target: protocolAwareString(target) });
    }
    outputCopy.push(current);
  }

  return outputCopy;
}

export function validatePaths(source: URL, target: URL): void {
  // Throws error if the source and target paths are not:
  // - both directories
  // - both paths
  if (source.pathname.endsWith('/') && target.pathname.endsWith('/')) {
    return;
  }
  if (!source.pathname.endsWith('/') && !target.pathname.endsWith('/')) {
    return;
  }
  throw new Error(`Path Mismatch - source: ${source.href}, target: ${target.href}`);
}

export type CommandCreateManifestArgs = CommandArguments<typeof commandCreateManifest>;
