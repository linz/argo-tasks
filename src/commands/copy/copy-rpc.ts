import type { FileInfo } from '@chunkd/core';

export type CopyContract = {
  copy(args: CopyContractArgs): Promise<CopyStats>;
};

export interface CopyContractArgs {
  /** Copy ID for tracing */
  id: string;

  /** List of files that need to be copied */
  manifest: { source: string; target: string }[];

  /** Offset into the manifest to start at */
  start: number;

  /** Number of records to copy */
  size: number;

  /** Force overwrite files.
   * When `deleteSource` is set, this will delete source files after a forced copy. */
  force: boolean;

  /** Do not overwrite existing files but skip them if they are the same size.
   * When `deleteSource` is set, this will delete source files that get skipped. */
  noClobber: boolean;

  /** Correct content-type from "application/octet-stream" to common formats */
  fixContentType: boolean;

  /** Compress files using zstandard while copying.
   * Will copy the uncompressed file if the compressed output is likely to be larger than the input (e.g. for very small files <90 bytes).
   * When compressing data, this will append `.zst` to the target file name. */
  compress: boolean;

  /** Decompress .zst files while copying.
   * Will copy the file if the file name does not end in `.zst`.
   * When decompressing data, this will remove `.zst` from the target file name. */
  decompress: boolean;

  /** Delete source files after copying or compressing */
  deleteSource: boolean;
}

export interface CopyStats {
  /** Number of files copied */
  copied: number;

  /** Number of bytes copied */
  copiedBytes: number;

  /** Number of files compressed */
  compressed: number;

  /** Number of bytes compressed (input) */
  compressedInputBytes: number;

  /** Number of bytes compressed (output) */
  compressedOutputBytes: number;

  /** Number of files decompressed */
  decompressed: number;

  /** Number of bytes decompressed (input) */
  decompressedInputBytes: number;

  /** Number of bytes decompressed (output) */
  decompressedOutputBytes: number;

  /** Number of source files deleted */
  deleted: number;

  /** Number of bytes deleted */
  deletedBytes: number;

  /** Number of files that have been skipped, generally because the target file already exists with identical hash */
  skipped: number;

  /** Number of bytes that has been skipped. */
  skippedBytes: number;

  /** Total number of files that have been read: Copied, Compressed, Decompressed */
  totalRead: number;

  /** Total number of bytes that have been read: Copied, Compressed, Decompressed */
  totalReadBytes: number;

  /** Total number of files that have been written: Copied, Compressed, Decompressed */
  totalWritten: number;

  /** Total number of bytes that have been written: Copied, Compressed, Decompressed */
  totalWrittenBytes: number;

  /**
   * Total number of files that have been processed: Copied, Compressed, Decompressed, Skipped.
   * Note: Excluding Deleted as this should match the total or be 0.
   */
  totalProcessed: number;

  /**
   * Total number of input bytes that have been read: Copied, Compressed, Decompressed, Skipped.
   * Note: Exluding Deleted as this should match the total or be 0
   * Also excluding bytes written, as this will match totalWrittenBytes (skip does not write any bytes).
   */
  totalProcessedBytes: number;
}

export const FileOperation = {
  Copy: 'copy',
  Skip: 'skip',
  Compress: 'compress',
  Decompress: 'decompress',
  Delete: 'delete', // pseudo-operation for deleting source files after other operations
} as const;
export type FileOperation = (typeof FileOperation)[keyof typeof FileOperation];

export interface TargetFileOperation {
  target: FileInfo;
  fileOperation: FileOperation;
  shouldDeleteSourceOnSuccess: boolean;
}
