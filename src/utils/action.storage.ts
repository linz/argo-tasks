import { UrlParser } from './parsers.js';

/**
 * Store actions as JSON documents on a file system rather than passing huge JSON documents around
 *
 * Uses $ACTION_PATH if set to store the actions to a user defined location
 * This parses $ARGO_TEMPLATE looking for a `archiveLocation`
 */
export async function getActionLocation(): Promise<URL | null> {
  if (process.env['ACTION_PATH']) return UrlParser.from(process.env['ACTION_PATH']);
  const loc = JSON.parse(process.env['ARGO_TEMPLATE'] ?? '{}')?.archiveLocation?.s3;
  if (loc == null) return null;
  if (typeof loc.key !== 'string') return null;

  const key = loc.key.replace(`/${process.env['ARGO_NODE_ID']}`, '');
  return new URL(`s3://${loc.bucket}/${key}`);
}
