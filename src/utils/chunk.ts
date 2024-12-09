import { fsa } from '@chunkd/fs';

import { parseSize } from '../commands/common.js';
import { logger } from '../log.js';

export interface FileSizeInfo {
  path: string;
  size?: number;
}

export async function* asyncFilter<T extends { path: string; size?: number }>(
  source: AsyncGenerator<T>,
  opts?: { include?: string; exclude?: string },
): AsyncGenerator<T> {
  const include = opts?.include ? new RegExp(opts.include.toLowerCase(), 'i') : true;
  const exclude = opts?.exclude ? new RegExp(opts.exclude.toLowerCase(), 'i') : undefined;
  for await (const f of source) {
    const testPath = f.path.toLowerCase();
    if (exclude && exclude.test(testPath)) continue;
    if (include === true) yield f;
    else if (include.test(testPath)) yield f;
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

/** Characters to split paths on @see splitPaths */
const PathSplitCharacters = /;|\n/;

/**
 * Split `;` separated paths into separate paths
 *
 * Argo has a limitation that arguments to CLIs cannot easily be lists of paths, so users can add multiple paths by creating a string with either `\n` or `;`
 *
 * @example
 * ```typescript
 * splitPaths(["a;b"]) // ['a', 'b']
 * splitPaths(["a\nb"]) // ['a', 'b']
 *````
 * @param paths
 */
export function splitPaths(paths: string[]): string[] {
  return paths.map((m) => m.split(PathSplitCharacters)).flat();
}

export type FileFilter = {
  include?: string;
  exclude?: string;

  /**
   * Limit the number of the output files
   */
  limit?: number;

  /**
   * Group files into this number of items group
   */
  group?: number;

  /**
   * Group the files into this size groups, see {@link parseSize}
   *
   * @example
   * ```
   * 5GB // 5 GB chunks
   * ```
   */
  groupSize?: string;

  /**
   * Files less than size are ignored
   *
   * @example
   *
   * ```typescript
   * if(file.size < sizeMin) continue
   * ```
   * @default 1
   */
  sizeMin: number;
};
export async function getFiles(paths: string[], args: FileFilter = { sizeMin: 1 }): Promise<string[][]> {
  const limit = args.limit ?? -1; // no limit by default
  const minSize = args.sizeMin ?? 1; // ignore 0 byte files
  const groupSize = parseSize(args.groupSize ?? '-1');
  const maxLength = args.group ?? -1;
  const outputFiles: FileSizeInfo[] = [];

  const fullPaths = splitPaths(paths);

  for (const rawPath of fullPaths) {
    const targetPath = rawPath.trim();
    logger.debug({ path: targetPath }, 'List');
    const fileList = await fsa.toArray(asyncFilter(fsa.details(targetPath), args));
    logger.info({ path: targetPath, fileCount: fileList.length }, 'List:Count');

    let totalSize = 0;
    for (const file of fileList) {
      if (file.size != null) {
        if (file.size < minSize) continue;
        totalSize += file.size;
      }
      outputFiles.push(file);
      if (limit > 0 && outputFiles.length >= limit) break;
    }
    if (limit > 0 && outputFiles.length >= limit) break;

    logger.info({ path: targetPath, fileCount: fileList.length, totalSize }, 'List:Size');
  }

  return chunkFiles(outputFiles, maxLength, groupSize);
}
