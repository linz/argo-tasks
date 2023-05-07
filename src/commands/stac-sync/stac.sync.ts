import { fsa } from '@chunkd/fs';
import { command, positional, string, Type } from 'cmd-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { createHash } from 'crypto';

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

  for await (const filePath of sourceFiles) {
    if (!filePath.endsWith('.json')) {
      continue;
    }
    const key = new URL(filePath.slice(sourcePath.length), destinationPath);
    const fileData = await fsa.read(filePath);

    (await uploadFileToS3(fileData, key)) && count++;
  }
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
export async function uploadFileToS3(fileData: Buffer, path: URL): Promise<boolean> {
  const hash = '1220' + createHash('sha256').update(fileData).digest('hex');
  const existing = await getHash(path);
  if (hash === existing) return false;

  await fsa.write(path.href, fileData, { metadata: { [HashKey]: hash } });
  logger.debug({ path: path.href }, 'StacSync:FileUploaded');
  return true;
}

/**
 * Get the hash of the file found in the HashKey value.
 *
 * @param Bucket
 * @param Key
 * @returns the hash if found
 */
export async function getHash(path: URL): Promise<string | null> {
  const objHead = await fsa.head(path.href);
  return objHead?.metadata?.[HashKey] ?? null;
}
