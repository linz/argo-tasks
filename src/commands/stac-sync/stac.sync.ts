import type { FileInfo } from '@chunkd/fs';
import { fsa } from '@chunkd/fs';
import { command, positional } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { md } from '../../readme/markdown.ts';
import { annotateExample } from '../../readme/readme.example.ts';
import { makeRelative, protocolAwareString } from '../../utils/filelist.ts';
import { hashBuffer, HashKey } from '../../utils/hash.ts';
import { config, guessStacContentType, registerCli, S3Path, UrlFolder, urlPathEndsWith, verbose } from '../common.ts';

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
    logger.info(
      { source: protocolAwareString(args.sourcePath), destination: protocolAwareString(args.destinationPath) },
      'StacSync:Start',
    );
    const nb = await synchroniseFiles(args.sourcePath, args.destinationPath);
    logger.info({ copied: nb }, 'StacSync:Done');
  },
});

annotateExample(commandStacSync, 'Sync STAC to s3', md.code('bash', 'stac sync /path/to/stac/ s3://nz-imagery/'));

/**
 * Synchronise STAC (JSON) files from one location to another.
 *
 * @param sourceLocation where the source files are
 * @param targetLocation S3 path where the files need to be synchronised
 * @returns the number of files copied over
 */
export async function synchroniseFiles(sourceLocation: URL, targetLocation: URL): Promise<number> {
  let count = 0;
  const sourceFilesInfo = await fsa.toArray(fsa.details(sourceLocation));

  await Promise.all(
    sourceFilesInfo.map(async (fileInfo) => {
      if (!urlPathEndsWith(fileInfo.url, '.json')) return;

      const key = new URL(makeRelative(sourceLocation, fileInfo.url), targetLocation);
      (await uploadFileToS3(fileInfo, key)) && count++;
    }),
  );

  return count;
}
/**
 * Upload a file to the destination if the same version (matched hash) does not exist.
 *
 * @param sourceFileInfo Source file metadata
 * @param targetLocation Target URL
 * @returns whether the file was uploaded
 */
export async function uploadFileToS3(sourceFileInfo: FileInfo, targetLocation: URL): Promise<boolean> {
  const destinationHead = await fsa.head(targetLocation);
  const sourceData = await fsa.read(sourceFileInfo.url);
  const sourceHash = hashBuffer(sourceData);
  if (destinationHead?.size === sourceFileInfo.size && sourceHash === destinationHead?.metadata?.[HashKey]) {
    return false;
  }

  await fsa.write(targetLocation, sourceData, {
    metadata: { [HashKey]: sourceHash },
    contentType: guessStacContentType(targetLocation),
  });
  logger.debug({ path: protocolAwareString(targetLocation) }, 'StacSync:FileUploaded');
  return true;
}
