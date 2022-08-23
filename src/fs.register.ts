import { FileSystem } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { FsAwsS3 } from '@chunkd/source-aws';
import { CredentialSource, FsAwsS3ProviderV2 } from '@chunkd/source-aws-v2';
import S3 from 'aws-sdk/clients/s3.js';

export function registerFileSystem(config?: string): void {
  const s3Fs = new FsAwsS3(new S3());
  fsa.register('s3://', s3Fs);

  const configPath = config ?? process.env['LINZ_BUCKET_CONFIG'];
  if (configPath == null || configPath === '') return;

  const provider = new FsAwsS3ProviderV2(configPath, fsa);
  provider.onFileSystemCreated = (ro: CredentialSource, fs: FileSystem): void => {
    console.log('NewFileSystem', ro.prefix);
    fsa.register(ro.prefix, fs);
  };
  s3Fs.credentials = provider;
}
