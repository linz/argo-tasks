import { fsa } from '@chunkd/fs';
import { command, flag, number, option, optional, restPositionals, string } from 'cmd-ts';
import { createHash } from 'crypto';
import path from 'path';
import { gzipSync } from 'zlib';

import { CliInfo } from '../../cli.info.js';
import { getActionLocation } from '../../utils/action.storage.js';
import { ActionCopy } from '../../utils/actions.js';
import { FileFilter, getFiles } from '../../utils/chunk.js';
import { UrlParser } from '../../utils/parsers.js';
import { config, registerCli, verbose } from '../common.js';

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
    output: option({
      type: UrlParser,
      long: 'output',
      description: 'Output location for the listing',
    }),
    target: option({ type: UrlParser, long: 'target', description: 'Copy destination' }),
    source: restPositionals({
      type: UrlParser,
      displayName: 'source',
      description: 'Where to list',
    }),
  },
  async handler(args) {
    registerCli(this, args);

    const outputCopy: string[] = [];

    const targetPath = args.target;
    const actionLocation = getActionLocation();
    for (const source of args.source) {
      const outputFiles = await createManifest(source, targetPath, args);
      for (const current of outputFiles) {
        const outBuf = Buffer.from(JSON.stringify(current));
        const targetHash = createHash('sha256').update(outBuf).digest('base64url');

        // Store the list of files to move in a bucket rather than the ARGO parameters
        if (actionLocation) {
          const targetLocation = fsa.join(actionLocation.href, `actions/manifest-${targetHash}.json`);
          const targetAction: ActionCopy = { action: 'copy', parameters: { manifest: current } };
          await fsa.write(targetLocation, JSON.stringify(targetAction));
          outputCopy.push(targetLocation);
        } else {
          outputCopy.push(gzipSync(outBuf).toString('base64url'));
        }
      }
    }
    await fsa.write(args.output.href, JSON.stringify(outputCopy));
  },
});

export type SourceTarget = { source: URL; target: URL };
export type ManifestFilter = FileFilter & { flatten: boolean; transform?: string };

function createTransformFunc(transform: string): (f: string) => string {
  if (transform.startsWith('return')) return new Function('f', transform) as (f: string) => string;
  return new Function('f', 'return ' + transform) as (f: string) => string;
}

export async function createManifest(sourceUrl: URL, targetUrl: URL, args: ManifestFilter): Promise<SourceTarget[][]> {
  const chunks = await getFiles([sourceUrl], args);
  const outputCopy: SourceTarget[][] = [];

  const transformFunc = args.transform ? createTransformFunc(args.transform) : null;

  for (const chunk of chunks) {
    const current: SourceTarget[] = [];

    for (const chunkUrl of chunk) {
      const baseFile = args.flatten ? path.basename(chunkUrl.href) : chunkUrl.href.slice(sourceUrl.href.length);
      let target = targetUrl;
      if (baseFile) {
        target = new URL(fsa.joinAll(targetUrl.href, transformFunc ? transformFunc(baseFile) : baseFile));
      }
      validatePaths(chunkUrl, target);
      current.push({ source: chunkUrl, target });
    }
    outputCopy.push(current);
  }

  return outputCopy;
}

export function validatePaths(source: URL, target: URL): void {
  // Throws error if the source and target paths are not:
  // - both directories
  // - both paths
  if (source.href.endsWith('/') && target.href.endsWith('/')) {
    return;
  }
  if (!source.href.endsWith('/') && !target.href.endsWith('/')) {
    return;
  }
  throw new Error(`Path Mismatch - source: ${source.href}, target: ${target.href}`);
}
