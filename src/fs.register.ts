import { FileSystem } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { FsAwsS3 } from '@chunkd/source-aws';
import { CredentialSource, FsAwsS3ProviderV2 } from '@chunkd/source-aws-v2';
import S3 from 'aws-sdk/clients/s3.js';
import { logger } from './log.js';

export function registerFileSystem(opts: { config?: string }): void {
  const s3Fs = new FsAwsS3(new S3());
  fsa.register('s3://', s3Fs);

  const configPath = opts.config ?? process.env['AWS_ROLE_CONFIG_PATH'];
  if (configPath == null || configPath === '') return;

  const provider = new FsAwsS3ProviderV2(configPath, fsa);
  provider.onFileSystemCreated = (ro: CredentialSource, fs: FileSystem): void => {
    logger.debug('FileSystem:Register', { prefix: ro.prefix, roleArn: ro.roleArn });
    fsa.register(ro.prefix, fs);
  };
  s3Fs.credentials = provider;
}
