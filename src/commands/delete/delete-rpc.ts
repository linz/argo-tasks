export type DeleteContract = {
  delete(args: DeleteContractArgs): Promise<DeleteStats>;
};

export interface DeleteStats {
  /** Number of files deleted */
  deleted: number;
  /** Number of files that have been skipped (generally not found or dry-run) */
  skipped: number;
}

export interface DeleteContractArgs {
  /** Delete ID for tracing */
  id: string;
  /** List of files that need to be deleted */
  manifest: { source: string; target: string }[]; //FIXME: should be another kind of manifest? the target is not used
  /** Offset into the manifest to start at */
  start: number;
  /** Number of records to delete */
  size: number;
  /** If true, do not actually delete the files */
  dryRun: boolean;
}
