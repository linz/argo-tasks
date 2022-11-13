/**
 * Get the argo artifact location if this is running in argo
 *
 * Uses $ARGO_ACTION_PATH if set to store the actions to a user defined location
 * This parses $ARGO_TEMPLATE looking for a `archiveLocation`
 */
export function getArgoLocation(): string | null {
  if (process.env['ARGO_ACTION_PATH']) return process.env['ARGO_ACTION_PATH'];
  const loc = JSON.parse(process.env['ARGO_TEMPLATE'] ?? '{}')?.archiveLocation?.s3;
  if (loc == null) return null;
  if (typeof loc.key !== 'string') return null;

  const key = loc.key.replace(`/${process.env['ARGO_NODE_ID']}`, '');
  return `s3://${loc.bucket}/${key}`;
}
