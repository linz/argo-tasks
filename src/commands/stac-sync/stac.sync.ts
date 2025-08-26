import type { FileInfo } from '@chunkd/fs';
import { fsa } from '@chunkd/fs';
import { command, positional } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { md } from '../../readme/markdown.ts';
import { annotateExample } from '../../readme/readme.example.ts';
import { hashBuffer, HashKey } from '../../utils/hash.ts';
import { config, registerCli, S3Path, UrlFolder, verbose } from '../common.ts';
import { makeRelative } from '../../utils/filelist.ts';

export const commandStacSync = command({
  name: 'stac-sync',
  description: 'Sync STAC files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    sourcePath: positional({ type: UrlFolder, description: 'Location of the source STAC to synchronise from' }),
    destinationPath: positional({
      type: S3Path,
      description: 'Location of the destination STAC in S3 to synchronise to',
    }),
  },

  async handler(args) {
    registerCli(this, args);
    logger.info({ source: args.sourcePath.href, destination: args.destinationPath }, 'StacSync:Start');
    const nb = await synchroniseFiles(args.sourcePath, args.destinationPath);
    logger.info({ copied: nb }, 'StacSync:Done');
  },
});

annotateExample(commandStacSync, 'Sync STAC to s3', md.code('bash', 'stac sync /path/to/stac/ s3://nz-imagery/'));

/**
 * Synchronise STAC (JSON) files from a path to another.
 *
 * @param sourcePath where the source files are
 * @param destinationPath S3 path where the files need to be synchronized
 * @returns the number of files copied over
 */
export async function synchroniseFiles(sourcePath: URL, destinationPath: URL): Promise<number> {
  let count = 0;
  const sourceFilesInfo = await fsa.toArray(fsa.details(sourcePath));

  await Promise.all(
    sourceFilesInfo.map(async (fileInfo) => {
      if (!fileInfo.url.pathname.endsWith('.json')) return;

      const key = new URL(makeRelative(sourcePath, fileInfo.url), destinationPath);
      (await uploadFileToS3(fileInfo, key)) && count++;
    }),
  );

  return count;
}
/**
 * Upload a file to the destination if the same version (matched hash) does not exist.
 *
 * @param sourceFileInfo Source file metadata
 * @param path Target URL
 * @returns whether the file was uploaded
 */
export async function uploadFileToS3(sourceFileInfo: FileInfo, path: URL): Promise<boolean> {
  const destinationHead = await fsa.head(path);
  const sourceData = await fsa.read(sourceFileInfo.url);
  const sourceHash = hashBuffer(sourceData);
  if (destinationHead?.size === sourceFileInfo.size && sourceHash === destinationHead?.metadata?.[HashKey]) {
    return false;
  }

  await fsa.write(path, sourceData, {
    metadata: { [HashKey]: sourceHash },
    contentType: guessStacContentType(path),
  });
  logger.debug({ path: path.href }, 'StacSync:FileUploaded');
  return true;
}

/**
 * Guess the content type of a STAC file
 *
 * - application/geo+json - A STAC Item
 * - application/json - A STAC Catalog
 * - application/json - A STAC Collection
 *
 * Assumes anything ending with '.json' is a stac item
 * @see {@link https://github.com/radiantearth/stac-spec/blob/master/catalog-spec/catalog-spec.md#stac-media-types}
 */
export function guessStacContentType(path: URL): string | undefined {
  if (path.pathname.endsWith('collection.json')) return 'application/json';
  if (path.pathname.endsWith('catalog.json')) return 'application/json';
  if (path.pathname.endsWith('.json')) return 'application/geo+json';
  return;
}
