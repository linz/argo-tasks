import { S3Client } from '@aws-sdk/client-s3';
import { FileSystem, fsa } from '@chunkd/fs';
import { AwsCredentialConfig, AwsS3CredentialProvider, FsAwsS3 } from '@chunkd/fs-aws';

import { logger } from './log.js';

export const s3Fs = new FsAwsS3(new S3Client());
const credentials = new AwsS3CredentialProvider();

FsAwsS3.MaxListCount = 1000;

s3Fs.credentials = credentials;
credentials.onFileSystemCreated = (acc: AwsCredentialConfig, fs: FileSystem): void => {
  logger.debug({ prefix: acc.prefix, roleArn: acc.roleArn }, 'FileSystem:Register');
  fsa.register(acc.prefix, fs);
};

function splitConfig(x: string): string[] {
  if (x.startsWith('[')) return JSON.parse(x) as string[];
  return x.split(',');
}

export function registerFileSystem(config?: string): void {
  fsa.register('s3://', s3Fs);

  if (config == null || config === '') return;

  const paths = splitConfig(config);

  for (const path of paths) credentials.registerConfig(fsa.toUrl(path), fsa);
}
