import { FileSystem } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { AwsCredentialConfig } from '@chunkd/source-aws';
import { FsAwsS3 } from '@chunkd/source-aws';
import { FsAwsS3V3 } from '@chunkd/source-aws-v3';

import { logger } from './log.js';

export const s3Fs = new FsAwsS3V3();
FsAwsS3.MaxListCount = 1000;
s3Fs.credentials.onFileSystemCreated = (acc: AwsCredentialConfig, fs: FileSystem): void => {
  logger.debug({ prefix: acc.prefix, roleArn: acc.roleArn }, 'FileSystem:Register');
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
