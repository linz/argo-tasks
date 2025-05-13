import { fsa } from '@chunkd/fs';
import { command, option, optional, positional } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, S3Path, tryParseUrl, UrlFolder, urlToString, verbose } from '../common.ts';

export const archiveSetup = command({
  name: 'archive-setup',
  description: 'VerifyOy the source needed to be archived and output the bucket name to be used for the archive',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    output: option({
      type: optional(UrlFolder),
      long: 'output',
      description: 'Where the archive bucket name will be output',
      defaultValueIsSerializable: true,
      defaultValue: () => tryParseUrl('/tmp/archive-setup/'),
    }),
    path: positional({ type: S3Path, displayName: 'path', description: 'Path of the files to be archived' }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();
    logger.info('ArchiveSetup:Start');

    const archiveBucketName = getArchiveBucketName(args.path.hostname);

    const archiveBucketNamePath = new URL('archive-bucket-name', args.output);
    await fsa.write(urlToString(archiveBucketNamePath), archiveBucketName);
    logger.info({ duration: performance.now() - startTime, archiveBucket: archiveBucketName }, 'ArchiveSetup:Done');
  },
});

/**
 * Get the archive bucket name for a given source bucket name.
 * @param sourceBucket - The name of the source bucket.
 * @returns The name of the archive bucket.
 */
export function getArchiveBucketName(sourceBucket: string): string {
  const bucketMapping = {
    'linz-topographic-upload': 'linz-topographic-archive',
    'linz-hydrographic-upload': 'linz-hydrographic-archive',
    'hydro-data-bucket': 'linz-hydrographic-archive',
  };

  if (!(sourceBucket in bucketMapping)) {
    throw new Error(`Source bucket ${sourceBucket} is not supported for archiving`);
  }

  return bucketMapping[sourceBucket as keyof typeof bucketMapping];
}
