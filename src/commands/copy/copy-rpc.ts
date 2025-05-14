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
  /** Delete source files after copying or compressing */
  deleteSource: boolean;
}

export interface CopyStats {
  /** Number of files copied */
  copied: number;
  /** Number of bytes copied */
  copiedBytes: number;
  /** Number of files copied + compressed */
  compressed: number;
  /** Number of bytes compressed (input) */
  inputBytes: number;
  /** Number of bytes compressed (output) */
  outputBytes: number;
  /** Number of source files deleted */
  deleted: number;
  /** Number of bytes deleted */
  deletedBytes: number;
  /** Number of times a file was retried */
  retries: number;
  /** Number of files that have been skipped, generally because the target file already exists */
  skipped: number;
  /** Number of bytes that has been skipped. */
  skippedBytes: number;
}
