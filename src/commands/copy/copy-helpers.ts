import type { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';

import { logger } from '../../log.ts';
import { tryHead } from '../../utils/file.head.ts';
import { HashKey, hashStream } from '../../utils/hash.ts';
import { isTiff } from '../tileindex-validate/tileindex.validate.ts';
import type { CopyContractArgs, CopyStats, TargetFileOperation } from './copy-rpc.ts';
import { FileOperation } from './copy-rpc.ts';

export const MinSizeForCompression = 500; // testing with random ASCII data shows that compression is not worth it below this size
export const CompressedFileExtension = '.zst';

const FixableContentType = new Set(['binary/octet-stream', 'application/octet-stream']);

/**
 * Updates the copy statistics based on the file operation performed.
 * This function is used to track the number of files copied, compressed, skipped, or deleted,
 * as well as the total bytes copied, compressed, or deleted.
 *
 * @param stats The current copy statistics.
 * @param sourceSize The size of the source file being processed.
 * @param outputSize The size of the output file after compression (optional, defaults to 0).
 * @returns void
 */
export const statsUpdaters: Record<FileOperation, (stats: CopyStats, sourceSize: number, outputSize?: number) => void> =
  {
    [FileOperation.Compress]: (stats, sourceSize, outputSize = 0): void => {
      stats.copied++;
      stats.copiedBytes += sourceSize;
      stats.compressed++;
      stats.compressedInputBytes += sourceSize;
      stats.compressedOutputBytes += outputSize;
    },
    [FileOperation.Copy]: (stats, sourceSize): void => {
      stats.copied++;
      stats.copiedBytes += sourceSize;
    },
    [FileOperation.Skip]: (stats, sourceSize): void => {
      stats.skipped++;
      stats.skippedBytes += sourceSize;
    },
    [FileOperation.Delete]: (stats, sourceSize): void => {
      stats.deleted++;
      stats.deletedBytes += sourceSize;
    },
  };

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

/**
 * Determines how to handle source files based on the command line arguments and whether the target file exists.
 * If the target file does not exist, the source file will be copied or compressed to the target file.
 * If the target file exists, it will be skipped or overwritten based on the command line arguments.
 *
 * @param source
 * @param initialTargetName
 * @param args
 */
export async function determineTargetFileOperation(
  source: FileInfo,
  initialTargetName: string,
  args: CopyContractArgs,
): Promise<TargetFileOperation> {
  const shouldCompress = shouldCompressFile(args.compress, source.size);
  const finalTargetName = initialTargetName + (shouldCompress ? CompressedFileExtension : '');

  const head = await tryHead(finalTargetName);
  const target = { ...head, path: head?.path ?? finalTargetName, size: head?.size ?? 0 } as FileInfo;
  const defaultOperation = shouldCompress ? FileOperation.Compress : FileOperation.Copy;
  const myTargetAction: TargetFileOperation = {
    target: target,
    fileOperation: FileOperation.Skip,
    shouldDeleteSourceOnSuccess: args.deleteSource || args.compress, // || shouldDecompress, // || shouldCompress,
  };

  source.metadata ??= {};
  source.metadata[HashKey] ??= await hashStream(fsa.stream(source.path));
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

/**
 * Verifies that the target file has been successfully written with the expected size and hash.
 *
 * @param target The path to the target file.
 * @param expectedSize The expected size of the target file.
 * @param expectedHash The expected hash of the target file.
 * @returns {boolean} True if the target file matches the expected size and hash, otherwise logs an error and returns false.
 */
export async function verifyTargetFile(target: string, expectedSize: number, expectedHash: string): Promise<boolean> {
  const targetReadBack = await tryHead(target);
  const targetSize = targetReadBack?.size;
  const targetHash = targetReadBack?.metadata?.[HashKey];

  const targetVerified = targetSize === expectedSize && targetHash === expectedHash;
  if (!targetVerified) logger.fatal({ target, expectedHash, targetHash, expectedSize, targetSize }, 'Copy:Failed');

  return targetVerified;
}

/**
 * Checks if a file should be compressed based on the size and compression flag.
 *
 * @param compress
 * @param size
 * @param minSize
 * @returns {boolean} True if the file should be compressed, false otherwise.
 */
function shouldCompressFile(compress: boolean, size: number = 0, minSize: number = MinSizeForCompression): boolean {
  return compress && size > minSize;
}
