export type CopyContract = {
  copy: (args: CopyContractArgs) => Promise<CopyStats>;
};

export interface CopyContractArgs {
  id: string;
  manifest: { source: string; target: string }[];
  start: number;
  size: number;
  force: boolean;
  noClobber: boolean;
}

export interface CopyStats {
  copied: number;
  copiedBytes: number;
  retries: number;
  skipped: number;
  skippedBytes: number;
}
