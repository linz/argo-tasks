export interface ActionCopy {
  action: 'copy';
  parameters: {
    manifest: { source: string; target: string }[];
  };
}
