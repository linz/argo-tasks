import type { FileInfo } from '@chunkd/core';

import { isTiff } from '../tileindex-validate/tileindex.validate.ts';

export const MIN_SIZE_FOR_COMPRESSION = 500; // testing with random ASCII data shows that compression is not worth it below this size
export const COMPRESSED_FILE_EXTENSION = '.zst';

const FixableContentType = new Set(['binary/octet-stream', 'application/octet-stream']);

/**
 * Sets contentEncoding metadata for compressed files.
 * Also, if the file has been written with a unknown binary contentType attempt to fix it with common content types
 *
 *
 * @param path File path to fix the metadata of
 * @param meta File metadata
 * @returns New fixed file metadata if fixed otherwise source file metadata
 */
export function fixFileMetadata(path: string, meta: FileInfo): FileInfo {
  if (path.toLowerCase().endsWith('.zst')) {
    return { ...meta, contentType: 'application/zstd' };
  }

  if (!FixableContentType.has(meta.contentType ?? 'binary/octet-stream')) return meta;

  // Assume our tiffs are cloud optimized
  if (isTiff(path)) return { ...meta, contentType: 'image/tiff; application=geotiff; profile=cloud-optimized' };

  // overwrite with application/json
  if (path.endsWith('.json')) return { ...meta, contentType: 'application/json' };

  return meta;
}
