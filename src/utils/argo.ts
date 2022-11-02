/**
 * Get the argo artifact location if this is running in argo
 *
 * This parses $ARGO_TEMPLATE looking for a `archiveLocation`
 */
export function getArgoLocation(): string | null {
  const loc = JSON.parse(process.env['ARGO_TEMPLATE'] ?? '{}')?.archiveLocation?.s3;
  if (loc == null) return null;

  const key = loc.key.replace('{{pod.name}}', '');
  return `s3://${loc.bucket}/${key}`;
}
