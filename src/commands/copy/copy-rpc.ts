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
  /** Force overwrite files */
  force: boolean;
  /** Do not overwrite existing files but skip them if they are the same size */
  noClobber: boolean;
}

export interface CopyStats {
  /** Number of files copied */
  copied: number;
  /** Number of bytes copied */
  copiedBytes: number;
  /** Number of times a file was retried */
  retries: number;
  /** Number of files that has been skipped, Generally because the file already exists */
  skipped: number;
  /** Number of bytes that has been skipped. */
  skippedBytes: number;
}
