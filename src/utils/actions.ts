export interface ActionCopy {
  action: 'copy';
  parameters: {
    manifest: { source: URL; target: URL }[];
  };
}
