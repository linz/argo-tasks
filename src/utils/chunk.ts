import { basename } from 'node:path/posix';

import { fsa } from '@chunkd/fs';

import { parseSize } from '../commands/common.ts';
import { logger } from '../log.ts';

export interface FileSizeInfo {
  url: URL;
  size?: number;
}

export async function* asyncFilter<T extends { url: URL; size?: number }>(
  source: AsyncGenerator<T>,
  opts?: { include?: string; exclude?: string },
): AsyncGenerator<T> {
  const include = opts?.include ? new RegExp(opts.include.toLowerCase(), 'i') : true;
  const exclude = opts?.exclude ? new RegExp(opts.exclude.toLowerCase(), 'i') : undefined;
  for await (const f of source) {
    const testPath = basename(f.url.href.toLowerCase());
    if (exclude && exclude.test(testPath)) continue;
    if (include === true) yield f;
    else if (include.test(testPath)) yield f;
  }
}

/** Chunk files into a max size (eg 1GB chunks) or max count (eg 100 files) or what ever comes first when both are defined */
export function chunkFiles(values: FileSizeInfo[], count: number, size: number): URL[][] {
  if (count == null && size == null) return [values.map((c) => c.url)];

  const output: URL[][] = [];
  let current: URL[] = [];
  let totalSize = 0;
  for (const v of values) {
    current.push(v.url);
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

// /** Characters to split paths on @see splitPaths */
// const PathSplitCharacters = /;|\n/;

// /**
//  * Split `;` separated paths into separate paths
//  *
//  * Argo has a limitation that arguments to CLIs cannot easily be lists of paths, so users can add multiple paths by creating a string with either `\n` or `;`
//  *
//  * @example
//  * ```typescript
//  * splitPaths(["a;b"]) // ['a', 'b']
//  * splitPaths(["a\nb"]) // ['a', 'b']
//  *````
//  * @param paths
//  */
// export function splitPaths(paths: URL[]): URL[] {
//   return paths.map((m) => m.split(PathSplitCharacters)).flat();
// }

export type FileFilter = {
  include?: string;
  exclude?: string;

  /**
   * Limit the number of the output files
   *
   * @default -1 - No limit
   */
  limit?: number;

  /**
   * Group files into this number of items group
   *
   * @default -1 - No limit
   */
  group?: number;

  /**
   * Group the files into this size groups, see {@link parseSize}
   *
   * @example
   * ```
   * 5GB // 5 GB chunks
   * ```
   *
   * @default -1 - No limit
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
  sizeMin?: number;
};
export async function getFiles(paths: URL[], args: FileFilter = {}): Promise<URL[][]> {
  const limit = args.limit ?? -1; // no limit by default
  const minSize = args.sizeMin ?? 1; // ignore 0 byte files
  const groupSize = parseSize(args.groupSize ?? '-1');
  const maxLength = args.group ?? -1;
  const outputFiles: FileSizeInfo[] = [];

  // const fullPaths = splitPaths(paths);

  for (const path of paths) {
    // const targetPath = rawPath.trim();
    logger.debug({ path }, 'List');
    // const fileList = await fsa.toArray(asyncFilter(fsa.details(fsa.toUrl(targetPath)), args));
    const fileList = await fsa.toArray(asyncFilter(fsa.details(path), args));
    logger.info({ path, fileCount: fileList.length }, 'List:Count');

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

    logger.info({ path, fileCount: fileList.length, totalSize }, 'List:Size');
  }

  return chunkFiles(outputFiles, maxLength, groupSize);
}

/**
 * Combine a base path with a relative path, resolving them to a single path.
 *
 * @param basePath The base path (can be a URL or local file path). Anything after the final "/" (i.e. a file name) will be removed.
 * @param addPath The path to combine with the base path. If this is an absolute path, it will overwrite basePath. Anything after the final "/" (i.e. a file name) will remain in place.
 * @returns The combined absolute path.
 */
export function xxcombinePaths(basePath: string, addPath: string): string {
  // If basePath is a local path, convert it to a `file://` URL for proper resolution
  const isLocal = !basePath.includes('://');
  const relativePrefix = isLocal ? basePath.substring(0, basePath.indexOf('/')) : '';

  const baseURL = new URL(isLocal ? `file://${basePath}` : basePath);

  // Resolve relative path against the base path
  const combinedPath = new URL(addPath, baseURL).href;

  // If the base path was a relative local path, convert the combined URL back to a local path
  return isLocal ? relativePrefix + new URL(combinedPath).pathname : combinedPath;
}
