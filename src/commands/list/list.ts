import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { config, parseSize, registerCli, verbose } from '../common.js';

export interface FileSizeInfo {
  path: string;
  size?: number;
}

export const commandList = command({
  name: 'list',
  args: {
    config,
    verbose,
    filter: option({ type: optional(string), long: 'filter', description: 'Filter files eg ".*.tiff"' }),
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
    version: option({ type: optional(string), long: 'version', description: 'Layer version to download' }),
    location: restPositionals({ type: string, displayName: 'location', description: 'Where to list' }),
  },
  handler: async (args) => {
    registerCli(args);

    const paths = args.location.map((c) => c.trim());

    const limit = args.limit ?? -1; // no limit by default
    const filter = args.filter ?? '*'; // Filter everything by default

    const outputFiles: FileSizeInfo[] = [];
    for (const targetPath of paths) {
      logger.debug({ path: targetPath }, 'List');
      const fileList = await fsa.toArray(asyncFilter(fsa.details(targetPath), filter));
      logger.info({ path: targetPath, fileCount: fileList.length }, 'List:Count');

      for (const file of fileList) {
        outputFiles.push(file);
        if (limit > 0 && outputFiles.length >= limit) break;
      }
      if (limit > 0 && outputFiles.length >= limit) break;
    }

    const maxSize = parseSize(args.groupSize ?? '-1');
    const maxLength = args.group ?? -1;
    await fsa.write(args.output, JSON.stringify(chunkFiles(outputFiles, maxLength, maxSize)));
  },
});

export async function* asyncFilter<T extends { path: string }>(
  source: AsyncGenerator<T>,
  filter: string,
): AsyncGenerator<T> {
  if (filter === '*') return yield* source;

  const re = new RegExp(filter.toLowerCase(), 'i');
  for await (const f of source) {
    // Always match on lowercase
    if (re.test(f.path.toLowerCase())) yield f;
  }
}

/** Chunk files into a max size (eg 1GB chunks) or max count (eg 100 files) or what ever comes first when both are defined */
export function chunkFiles(values: FileSizeInfo[], count: number, size: number): string[][] {
  if (count == null && size == null) return [values.map((c) => c.path)];

  const output: string[][] = [];
  let current: string[] = [];
  let totalSize = 0;
  for (const v of values) {
    current.push(v.path);
    if (v.size) totalSize += v.size;
    if ((count > 0 && current.length >= count) || (size > 0 && totalSize >= size)) {
      output.push(current);
      current = [];
      totalSize = 0;
    }
  }
  if (current.length > 0) output.push(current);
  return output;
}
