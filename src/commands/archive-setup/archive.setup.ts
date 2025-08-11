import { fsa } from '@chunkd/fs';
import { command, option, optional, positional } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, S3Path, tryParseUrl, UrlFolder, verbose } from '../common.ts';

export const archiveSetup = command({
  name: 'archive-setup',
  description: 'Verify if the source path can be archived and output the archive location to use',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    output: option({
      type: optional(UrlFolder),
      long: 'output',
      description: 'Where the archive location will be output',
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
    if (!isSafePath(args.path)) {
      throw new Error(`The path ${args.path.toString()} is not safe for archiving. Please check the path.`);
    }

    const archiveLocation = getArchiveLocation(args.path, archiveBucketName);
    const archiveLocationOutputPath = new URL('archive-location', args.output);

    await fsa.write(archiveLocationOutputPath, archiveLocation);

    logger.info({ duration: performance.now() - startTime, archiveLocation }, 'ArchiveSetup:Done');
  },
});

/**
 * Get the archive bucket name for a given source bucket name.
 *
 * @param sourceBucket - The name of the source bucket.
 * @returns The name of the archive bucket.
 * @throws Error if the source bucket is not supported for archiving.
 *
 */
export function getArchiveBucketName(sourceBucket: string): string {
  const bucketMapping = {
    'linz-topographic-upload': 'linz-topographic-archive',
    'linz-hydrographic-upload': 'linz-hydrographic-archive',
  };

  // special case for hydro-data-bucket-* as it ends with an AWS account id which we should not share publicly
  if (sourceBucket.startsWith('hydro-data-bucket-')) {
    return 'linz-hydrographic-archive';
  }

  if (!(sourceBucket in bucketMapping)) {
    throw new Error(`Source bucket ${sourceBucket} is not supported for archiving`);
  }

  return bucketMapping[sourceBucket as keyof typeof bucketMapping];
}

/**
 * Check if a path is safe for archiving as the source files will be deleted.
 * Example: `s3://uploads/provider_a/dataset_1/supply_1/` - we would not like to archive the whole `provider_a` folder, or deleting everything in the bucket...
 *
 * @param path - The path to check.
 * @param minDepth - The minimum depth required. Default is 2.
 * @returns True if the path is safe for archiving, false otherwise.
 */
export function isSafePath(path: URL, minDepth = 2): boolean {
  const directories = path.pathname.split('/').filter(Boolean); // skip empty parts

  return directories.length >= minDepth;
}

/** Get the archive location for a given source path and archive bucket name.
 *
 * @param sourcePath - The path where the files to archive are.
 * @param archiveBucketName - The name of the bucket to use to archive the files.
 * @returns the path where the archived files should be stored.
 */
export function getArchiveLocation(sourcePath: URL, archiveBucketName: string): string {
  const archiveLocation = new URL(sourcePath.toString());
  archiveLocation.hostname = archiveBucketName;
  return archiveLocation.toString();
}
