import { fsa } from '@chunkd/fs';
import { parseSize } from '../commands/common.js';
import { logger } from '../log.js';

export interface FileSizeInfo {
  path: string;
  size?: number;
}

export async function* asyncFilter<T extends { path: string }>(
  source: AsyncGenerator<T>,
  opts?: { include?: string[]; exclude?: string[] },
): AsyncGenerator<T> {
  const includes = opts?.include?.map((i) => new RegExp(i.toLowerCase(), 'i')) ?? [];
  const excludes = opts?.exclude?.map((e) => new RegExp(e.toLowerCase(), 'i')) ?? [];
  for await (const f of source) {
    const testPath = f.path.toLowerCase();
    if (excludes.find((f) => f.test(testPath))) continue;
    if (includes.find((f) => f.test(testPath))) yield f;
    if (includes.length === 0) yield f;
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

export async function getFiles(
  paths: string[],
  args: { include?: string[]; exclude?: string[]; limit?: number; group?: number; groupSize?: string },
): Promise<string[][]> {
  const limit = args.limit ?? -1; // no limit by default
  const maxSize = parseSize(args.groupSize ?? '-1');
  const maxLength = args.group ?? -1;
  const outputFiles: FileSizeInfo[] = [];
  for (const rawPath of paths) {
    const targetPath = rawPath.trim();
    logger.debug({ path: targetPath }, 'List');
    const fileList = await fsa.toArray(asyncFilter(fsa.details(targetPath), args));
    logger.info({ path: targetPath, fileCount: fileList.length }, 'List:Count');

    for (const file of fileList) {
      outputFiles.push(file);
      if (limit > 0 && outputFiles.length >= limit) break;
    }
    if (limit > 0 && outputFiles.length >= limit) break;
  }

  return chunkFiles(outputFiles, maxLength, maxSize);
}
