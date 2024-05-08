import { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { command, positional, string, Type } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { hashBuffer } from '../../utils/hash.js';
import { config, registerCli, verbose } from '../common.js';

const S3Path: Type<string, URL> = {
  async from(str) {
    if (!str.startsWith('s3://')) throw new Error('Path is not S3');
    return new URL(str);
  },
};

export const commandStacSync = command({
  name: 'stac-sync',
  description: 'Sync STAC files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    sourcePath: positional({ type: string, description: 'Location of the source STAC to synchronise from' }),
    destinationPath: positional({
      type: S3Path,
      description: 'Location of the destination STAC in S3 to synchronise to',
    }),
  },

  async handler(args) {
    registerCli(this, args);
    logger.info({ source: args.sourcePath, destination: args.destinationPath }, 'StacSync:Start');
    const nb = await synchroniseFiles(args.sourcePath, args.destinationPath);
    logger.info({ copied: nb }, 'StacSync:Done');
  },
});

/** Key concatenated to 'x-amz-meta-' */
export const HashKey = 'linz-hash';

/**
 * Synchronise STAC (JSON) files from a path to another.
 *
 * @param sourcePath where the source files are
 * @param destinationPath S3 path where the files need to be synchronized
 * @returns the number of files copied over
 */
export async function synchroniseFiles(sourcePath: string, destinationPath: URL): Promise<number> {
  let count = 0;
  const sourceFilesInfo = await fsa.toArray(fsa.details(sourcePath));

  await Promise.all(
    sourceFilesInfo.map(async (fileInfo) => {
      if (!fileInfo.path.endsWith('.json')) return;

      const key = new URL(fileInfo.path.slice(sourcePath.length), destinationPath);
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
  const destinationHead = await fsa.head(path.href);
  const sourceData = await fsa.read(sourceFileInfo.path);
  const sourceHash = hashBuffer(sourceData);
  if (destinationHead?.size === sourceFileInfo.size && sourceHash === destinationHead?.metadata?.[HashKey]) {
    return false;
  }

  await fsa.write(path.href, sourceData, {
    metadata: { [HashKey]: sourceHash },
    contentType: guessStacContentType(path.href),
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
function guessStacContentType(path: string): string | undefined {
  if (path.endsWith('collection.json')) return 'application/json';
  if (path.endsWith('catalog.json')) return 'application/json';
  if (path.endsWith('.json')) return 'application/geo+json';
  return;
}
