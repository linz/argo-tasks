import { S3Client } from '@aws-sdk/client-s3';
import { FileSystem } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { AwsCredentialConfig } from '@chunkd/source-aws';
import { FsAwsS3 } from '@chunkd/source-aws';
import { FsAwsS3V3, S3LikeV3 } from '@chunkd/source-aws-v3';
import { FinalizeRequestMiddleware, MetadataBearer } from '@smithy/types';

import { logger } from './log.js';

/** Check to see if hostname exists inside of a object */
function hasHostName(x: unknown): x is { hostname: string } {
  if (x == null) return false;
  if (typeof x === 'object' && 'hostname' in x && typeof x.hostname === 'string') return true;
  return false;
}

/**
 * AWS SDK middleware function to force fully qualified domain name  on s3 requests
 *
 * AWS S3 inside of kubernetes triggers a lot of DNS requests
 * by forcing a fully qualified domain name lookup (trailing ".")
 * it greatly reduces the number of DNS requests we make
 */
export const fqdn: FinalizeRequestMiddleware<object, MetadataBearer> = (next) => {
  return (args) => {
    if (hasHostName(args.request) && args.request.hostname.endsWith('ap-southeast-2.amazonaws.com')) {
      args.request.hostname += '.';
    }
    return next(args);
  };
};

const client = new S3Client();
export const s3Fs = new FsAwsS3V3(client);
client.middlewareStack.add(fqdn, { name: 'FQDN', step: 'finalizeRequest' });

FsAwsS3.MaxListCount = 1000;
s3Fs.credentials.onFileSystemCreated = (acc: AwsCredentialConfig, fs: FileSystem): void => {
  logger.debug({ prefix: acc.prefix, roleArn: acc.roleArn }, 'FileSystem:Register');

  if (fs.protocol === 's3') {
    // TODO this cast can be removed once chunkd is upgraded
    const fsS3 = fs as FsAwsS3V3;
    const fsClient = fsS3.s3 as S3LikeV3;
    fsClient.client.middlewareStack.add(fqdn, { name: 'FQDN', step: 'finalizeRequest' });
  }

  fsa.register(acc.prefix, fs);
};

function splitConfig(x: string): string[] {
  if (x.startsWith('[')) return JSON.parse(x) as string[];
  return x.split(',');
}

export function registerFileSystem(opts: { config?: string }): void {
  fsa.register('s3://', s3Fs);

  const configPath = opts.config ?? process.env['AWS_ROLE_CONFIG_PATH'];
  if (configPath == null || configPath === '') return;

  const paths = splitConfig(configPath);

  for (const path of paths) s3Fs.credentials.registerConfig(path, fsa);
}
