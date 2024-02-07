import { fsa } from '@chunkd/fs';

import { parseSize } from '../commands/common.js';
import { logger } from '../log.js';

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
    const testPath = f.url.href.toLowerCase();
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
export type FileFilter = { include?: string; exclude?: string; limit?: number; group?: number; groupSize?: string };
export async function getFiles(paths: URL[], args: FileFilter = {}): Promise<URL[][]> {
  const limit = args.limit ?? -1; // no limit by default
  const maxSize = parseSize(args.groupSize ?? '-1');
  const maxLength = args.group ?? -1;
  const outputFiles: FileSizeInfo[] = [];
  for (const rawPath of paths) {
    const targetPath = rawPath;
    logger.debug({ path: targetPath }, 'List');
    const fileList = await fsa.toArray(asyncFilter(fsa.details(targetPath), args));
    logger.info({ path: targetPath, fileCount: fileList.length }, 'List:Count');

    let size = 0;
    for (const file of fileList) {
      // Skip empty files
      if (file.size === 0) continue;
      if (file.size != null) size += file.size;
      outputFiles.push({ url: file.url, size: file.size } as FileSizeInfo);
      if (limit > 0 && outputFiles.length >= limit) break;
    }
    if (limit > 0 && outputFiles.length >= limit) break;

    logger.info({ path: targetPath, fileCount: fileList.length, totalSize: size }, 'List:Size');
  }

  return chunkFiles(outputFiles, maxLength, maxSize);
}
