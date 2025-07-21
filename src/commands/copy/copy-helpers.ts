import type { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';

import { logger } from '../../log.ts';
import { tryHead } from '../../utils/file.head.ts';
import { HashKey, hashStream } from '../../utils/hash.ts';
import { isTiff } from '../tileindex-validate/tileindex.validate.ts';
import type { CopyContractArgs, TargetFileOperation } from './copy-rpc.ts';
import { FileOperation } from './copy-rpc.ts';

export const MinSizeForCompression = 500; // testing with random ASCII data shows that compression is not worth it below this size
export const CompressedFileExtension = '.zst';

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
export async function determineTargetFileOperation(
  source: FileInfo,
  initialTargetName: string,
  args: CopyContractArgs,
): Promise<TargetFileOperation> {
  const shouldCompress = args.compress && source.size !== undefined && source.size > MinSizeForCompression;
  const finalTargetName = initialTargetName + (shouldCompress ? CompressedFileExtension : '');

  const target = (await fsa.head(finalTargetName)) || { path: finalTargetName, size: 0 };
  const defaultOperation = shouldCompress ? FileOperation.Compress : FileOperation.Copy;
  const myTargetAction: TargetFileOperation = {
    target: target,
    fileOperation: FileOperation.Skip,
    shouldDeleteSourceOnSuccess: args.deleteSource || args.compress, // || shouldDecompress, // || shouldCompress,
  };

  if (!source.metadata) source.metadata = {};
  source.metadata[HashKey] ||= await hashStream(fsa.stream(source.path)); // Todo: add logging for start/end hash?
  const hashMisMatch = source.metadata[HashKey] !== target?.metadata?.[HashKey];

  if (target.size === 0) {
    // If the target file does not exist, we need to copy / compress / decompress (not skip) it
    myTargetAction.fileOperation = defaultOperation;
  } else if (args.force && args.noClobber) {
    // With force and noClobber, we overwrite existing files only if they changed
    // Calc hash for source - if target has no metadata, we assume it is a new file (this way, the file will get a hash for future checks)
    if (hashMisMatch) myTargetAction.fileOperation = defaultOperation;
  } else if (args.noClobber && hashMisMatch) {
    // With noClobber (and not force), we do not overwrite existing files (only copy new files).
    // Error if the target file already exists and has a different hash.
    logger.error({ target: target.path, source: source.path }, 'File:Overwrite');
    throw new Error(
      'Target already exists with different hash. Use --force to overwrite. target: ' +
        target.path +
        ' source: ' +
        source.path,
    );
  }
  return myTargetAction;
}

export async function verifyTargetFile(target: string, expectedSize: number, expectedHash: string): Promise<boolean> {
  const targetReadBack = await tryHead(target);
  const targetSize = targetReadBack?.size;
  const targetHash = targetReadBack?.metadata?.[HashKey];

  const targetVerified = targetSize === expectedSize && targetHash === expectedHash;
  if (!targetVerified) logger.fatal({ target, expectedHash, targetHash, expectedSize, targetSize }, 'Copy:Failed');

  return targetVerified;
}
