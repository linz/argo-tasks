import type { FileInfo } from '@chunkd/fs';
import { fsa } from '@chunkd/fs';

import { logger } from '../../log.ts';
import { tryHead } from '../../utils/file.head.ts';
import { HashKey, hashStream } from '../../utils/hash.ts';
import { guessStacContentType, isJson, replaceUrlExtension, urlPathEndsWith } from '../common.ts';
import { isTiff } from '../tileindex-validate/tileindex.validate.ts';
import type { CopyContractArgs, CopyStatItem, CopyStats, TargetFileOperation } from './copy-rpc.ts';
import { FileOperation } from './copy-rpc.ts';

export const MinSizeForCompression = 500; // testing with random ASCII data shows that compression is not worth it below this size
export const CompressedFileExtension = '.zst';

const FixableContentType = new Set(['binary/octet-stream', 'application/octet-stream']);

/**
 * Merges two CopyStats objects by summing their individual statistics.
 *
 * @param stats The first CopyStats object.
 * @param other The second CopyStats object.
 * @returns A new CopyStats object containing the merged statistics.
 */
export function mergeStats(stats: CopyStats, other: CopyStats): CopyStats {
  return {
    copied: mergeStatItem(stats.copied, other.copied),
    compressed: mergeStatItem(stats.compressed, other.compressed),
    decompressed: mergeStatItem(stats.decompressed, other.decompressed),
    skipped: mergeStatItem(stats.skipped, other.skipped),
    deleted: mergeStatItem(stats.deleted, other.deleted),
    processed: mergeStatItem(stats.processed, other.processed),
    total: mergeStatItem(stats.total, other.total),
  };
}

/**
 * Merges two statistics items by summing their counts and bytes.
 *
 * @param a The first statistics item
 * @param b The second statistics item
 * @returns A new object containing the summed statistics.
 */
function mergeStatItem(a: CopyStatItem, b: CopyStatItem): CopyStatItem {
  return {
    count: a.count + b.count,
    bytesIn: a.bytesIn + b.bytesIn,
    bytesOut: a.bytesOut + b.bytesOut,
  };
}

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
      stats.compressed.count++;
      stats.compressed.bytesIn += sourceSize;
      stats.compressed.bytesOut += outputSize;

      stats.processed.count++;
      stats.processed.bytesIn += sourceSize;
      stats.processed.bytesOut += outputSize;

      stats.total.count++;
      stats.total.bytesIn += sourceSize;
      stats.total.bytesOut += outputSize;
    },
    [FileOperation.Decompress]: (stats, sourceSize, outputSize = 0): void => {
      stats.decompressed.count++;
      stats.decompressed.bytesIn += sourceSize;
      stats.decompressed.bytesOut += outputSize;

      stats.processed.count++;
      stats.processed.bytesIn += sourceSize;
      stats.processed.bytesOut += outputSize;

      stats.total.count++;
      stats.total.bytesIn += sourceSize;
      stats.total.bytesOut += outputSize;
    },
    [FileOperation.Copy]: (stats, sourceSize): void => {
      stats.copied.count++;
      stats.copied.bytesIn += sourceSize;
      stats.copied.bytesOut += sourceSize;

      stats.processed.count++;
      stats.processed.bytesIn += sourceSize;
      stats.processed.bytesOut += sourceSize;

      stats.total.count++;
      stats.total.bytesIn += sourceSize;
      stats.total.bytesOut += sourceSize;
    },
    [FileOperation.Skip]: (stats, sourceSize): void => {
      stats.skipped.count++;
      stats.skipped.bytesIn += sourceSize;
      stats.skipped.bytesOut += 0; // Skipped files do not have an output size

      stats.total.count++;
      stats.total.bytesIn += sourceSize;
    },
    [FileOperation.Delete]: (stats, sourceSize): void => {
      stats.deleted.count++;
      stats.deleted.bytesIn += sourceSize;
      stats.deleted.bytesOut += 0; // Deleted files do not have an output size
    },
  };

/**
 * Sets contentEncoding metadata for compressed files.
 * Also, if the file has been written with an unknown binary contentType attempt to fix it with common content types
 *
 *
 * @param location URL of file to fix the metadata of
 * @param meta File metadata
 * @returns New fixed file metadata if fixed otherwise source file metadata
 */
export function fixFileMetadata(location: URL, meta: FileInfo): FileInfo {
  if (urlPathEndsWith(location, CompressedFileExtension)) {
    return { ...meta, contentType: 'application/zstd' };
  } else if (meta.contentType === 'application/zstd') {
    // if content type is `zstd` but extension isn't, set to a "fixable" content type
    meta = { ...meta, contentType: 'binary/octet-stream' };
  }

  if (!FixableContentType.has(meta.contentType ?? 'binary/octet-stream')) return meta;

  // Assume our tiffs are cloud optimized
  if (isTiff(location)) return { ...meta, contentType: 'image/tiff; application=geotiff; profile=cloud-optimized' };

  // Overwrite with application/json, or application/geo+json for geojson files
  if (isJson(location)) return { ...meta, contentType: guessStacContentType(location) };

  return meta;
}

/**
 * Determines how to handle source files based on the command line arguments and whether the target file exists.
 * If the target file does not exist, the source file will be copied or compressed to the target file.
 * If the target file exists, it will be skipped or overwritten based on the command line arguments.
 *
 * @param source
 * @param initialTargetURL
 * @param args
 */
export async function determineTargetFileOperation(
  source: FileInfo,
  initialTargetURL: URL,
  args: CopyContractArgs,
): Promise<TargetFileOperation> {
  const shouldCompress = shouldCompressFile(args.compress, source.size, MinSizeForCompression);
  const shouldDecompress = shouldDecompressFile(args.decompress, source.url, CompressedFileExtension);

  let finalTargetURL = initialTargetURL;
  if (shouldDecompress) {
    // If we decompress, we remove the .zst extension from the target name
    finalTargetURL = replaceUrlExtension(initialTargetURL, new RegExp('\\' + CompressedFileExtension + '$', 'i'));
  } else if (shouldCompress) {
    // If we compress, we append the .zst extension to the target name
    finalTargetURL = new URL(initialTargetURL.href + CompressedFileExtension);
  }

  const head = await tryHead(finalTargetURL);
  const target = { ...head, url: head?.url ?? finalTargetURL, size: head?.size ?? 0 } as FileInfo;
  const defaultOperation = shouldDecompress
    ? FileOperation.Decompress
    : shouldCompress
      ? FileOperation.Compress
      : FileOperation.Copy;
  const myTargetAction: TargetFileOperation = {
    target: target,
    fileOperation: FileOperation.Skip,
    shouldDeleteSourceOnSuccess: args.deleteSource || args.compress, // || shouldDecompress, // || shouldCompress,
  };

  source.metadata ??= {};
  source.metadata[HashKey] ??= await hashStream(fsa.readStream(source.url));
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
    logger.error({ target: target.url.href, source: source.url.href }, 'File:Overwrite');
    throw new Error(
      'Target already exists with different hash. Use --force to overwrite. target: ' +
        target.url.toString() +
        ' source: ' +
        source.url.toString(),
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
export async function verifyTargetFile(target: URL, expectedSize: number, expectedHash: string): Promise<boolean> {
  const targetReadBack = await tryHead(target);
  const targetSize = targetReadBack?.size;
  // const targetFs = fsa.get(target, 'rw');

  const targetHash = targetReadBack?.metadata?.[HashKey];

  // TODO: Local file system does not support metadata so assume hash is correct
  if (target.protocol === 'file:') {
    const targetVerified = targetSize === expectedSize;
    if (!targetVerified) logger.fatal({ target, expectedHash, targetHash, expectedSize, targetSize }, 'Copy:Failed');

    return targetVerified;
  }

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
  return compress && size >= minSize;
}

/**
 * Checks if a file should be decompressed based on file name extension and decompression flag.
 *
 * @param decompress
 * @param filename
 * @param decompressExtension The file extension that indicates the file is compressed (default is `.zst`).
 * @returns {boolean} True if the file should be decompressed, false otherwise.
 */
function shouldDecompressFile(
  decompress: boolean,
  filename: URL,
  decompressExtension: string = CompressedFileExtension,
): boolean {
  return decompress && filename.pathname.endsWith(decompressExtension);
}
