import { fsa } from '@chunkd/fs';
import { command, positional, string, Type } from 'cmd-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { createHash, Hash } from 'crypto';

const S3Path: Type<string, URL> = {
  async from(str) {
    if (!str.startsWith('s3://')) throw new Error('Path is not S3');
    return new URL(str);
  },
};

export const commandStacSync = command({
  name: 'stac-sync',
  description: 'Sync STAC files',
  args: {
    config,
    verbose,
    sourcePath: positional({ type: string, description: 'Location of the source STAC to synchronise from' }),
    destinationPath: positional({
      type: S3Path,
      description: 'Location of the destination STAC in S3 to synchronise to',
    }),
  },

  handler: async (args) => {
    registerCli(args);
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
  const sourceFiles = await fsa.toArray(fsa.list(sourcePath));

  await Promise.all(
    sourceFiles.map(async (filePath) => {
      if (filePath.endsWith('.json')) {
        const key = new URL(filePath.slice(sourcePath.length), destinationPath);

        (await uploadFileToS3(filePath, key)) && count++;
      }
    }),
  );

  return count;
}

/**
 * Upload a file to the destination if the same version (matched hash) does not exist.
 *
 * @param fileData source file data
 * @param bucket destination bucket
 * @param key destination key
 * @returns
 */
export async function uploadFileToS3(sourcePath: string, path: URL): Promise<boolean> {
  const destinationHead = await fsa.head(path.href);
  const sourceData = await fsa.read(sourcePath);
  const sourceHash = '1220' + createHash('sha256').update(sourceData).digest('hex');
  if (destinationHead != null) {
    const sourceHead = await fsa.head(sourcePath);
    if (sourceHash === destinationHead?.metadata?.[HashKey] && sourceHead?.size === destinationHead?.size) {
      return false;
    }
  }

  await fsa.write(path.href, sourceData, { metadata: { [HashKey]: sourceHash } });
  logger.debug({ path: path.href }, 'StacSync:FileUploaded');
  return true;
}
