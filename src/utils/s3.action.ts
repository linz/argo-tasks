export type S3Action = S3ActionCopy;

export interface S3ActionCopy {
  action: 'copy';
  parameters: {
    manifest: { source: string; target: string }[];
  };
}
