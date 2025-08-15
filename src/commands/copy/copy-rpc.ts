import type { FileInfo } from '@chunkd/fs';

export type CopyContract = {
  copy(args: CopyContractArgs): Promise<CopyStats>;
};

export interface CopyContractArgs {
  /** Copy ID for tracing */
  id: string;

  /** List of files that need to be copied */
  manifest: { source: URL; target: URL }[];

  /** Offset into the manifest to start at */
  start: number;

  /** Number of records to copy */
  size: number;

  /**
   * Force overwrite files.
   * When `deleteSource` is set, this will delete source files after a forced copy.
   */
  force: boolean;

  /**
   * Do not overwrite existing files but skip them if they are the same size.
   * When `deleteSource` is set, this will delete source files that get skipped.
   */
  noClobber: boolean;

  /** Correct content-type from "application/octet-stream" to common formats */
  fixContentType: boolean;

  /**
   * Compress files using zstandard while copying.
   * Will copy the uncompressed file if the compressed output is likely to be larger than the input (e.g. for very small files <90 bytes).
   * When compressing data, this will append `.zst` to the target file name.
   */
  compress: boolean;

  /**
   * Decompress .zst files while copying.
   * Will copy the file if the file name does not end in `.zst`.
   * When decompressing data, this will remove `.zst` from the target file name.
   */
  decompress: boolean;

  /** Delete source files after copying or compressing */
  deleteSource: boolean;
}
export interface CopyStatItem {
  count: number;
  bytesIn: number;
  bytesOut: number;
}

export interface CopyStats {
  /** Number of files copied */
  copied: CopyStatItem;

  /** Number of files compressed */
  compressed: CopyStatItem;

  /** Number of files decompressed */
  decompressed: CopyStatItem;

  /** Number of source files deleted */
  deleted: CopyStatItem;

  /** Number of files skipped (generally because the target file already exists with identical hash) */
  skipped: CopyStatItem;

  /** Number of files processed (Copied, Compressed or Decompressed - not skipped) */
  processed: CopyStatItem;

  /**
   * Total number of files (Skipped, Copied, Compressed, Decompressed).
   * Note: Excluding Deleted as this should match the grand total or be 0.
   */
  total: CopyStatItem;
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
