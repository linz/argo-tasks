import type { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';

/**
 * S3 Writes do not always show up instantly as we have read the location earlier in the function
 *
 * try reading the path {retryCount} times before aborting, with a delay of 250ms between requests
 *
 * @param filePath File to head
 * @param retryCount number of times to retry
 * @returns file size if it exists or null
 */
export async function tryHead(filePath: URL, retryCount = 3): Promise<FileInfo | null> {
  for (let i = 0; i < retryCount; i++) {
    const ret = await fsa.head(filePath);
    if (ret?.size) return ret;
    await new Promise((r) => setTimeout(r, 50 + i * 100));
  }
  return null;
}
