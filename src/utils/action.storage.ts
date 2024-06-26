/**
 * Store actions as JSON documents on a file system rather than passing huge JSON documents around
 *
 * Uses $ACTION_PATH if set to store the actions to a user defined location
 * This parses $ARGO_TEMPLATE looking for a `archiveLocation`
 */
export function getActionLocation(): string | null {
  if (process.env['ACTION_PATH']) return process.env['ACTION_PATH'];
  const argoTemplate = JSON.parse(process.env['ARGO_TEMPLATE'] ?? '{}') as ArgoTemplate;
  const loc = argoTemplate.archiveLocation?.s3;
  if (loc == null) return null;
  if (typeof loc.key !== 'string') return null;

  const key = loc.key.replace(`/${process.env['ARGO_NODE_ID']}`, '');
  return `s3://${loc.bucket}/${key}`;
}

export interface ArgoTemplate {
  archiveLocation?: { s3?: { key: string; bucket: string } };
}
