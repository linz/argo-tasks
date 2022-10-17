import { FileSystem } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { FsAwsS3, FsAwsS3Provider } from '@chunkd/source-aws';
import { CredentialSource, FsAwsS3ProviderV2 } from '@chunkd/source-aws-v2';
import S3 from 'aws-sdk/clients/s3.js';
import { logger } from './log.js';

function splitConfig(x: string): string[] {
  if (x.startsWith('[')) return JSON.parse(x) as string[];
  return x.split(',');
}

export function registerFileSystem(opts: { config?: string }): void {
  const s3Fs = new FsAwsS3(new S3());
  fsa.register('s3://', s3Fs);

  const configPath = opts.config ?? process.env['AWS_ROLE_CONFIG_PATH'];
  if (configPath == null || configPath === '') return;

  const provider = new FsAwsS3ProviderList(splitConfig(configPath));
  s3Fs.credentials = provider;
}

export class FsAwsS3ProviderList implements FsAwsS3Provider {
  providers: FsAwsS3ProviderV2[] = [];

  constructor(paths: string[]) {
    for (const path of paths) {
      const provider = new FsAwsS3ProviderV2(path, fsa);
      this.providers.push(provider);
      provider.onFileSystemCreated = (ro: CredentialSource, fs: FileSystem): void => {
        logger.debug({ prefix: ro.prefix, roleArn: ro.roleArn }, 'FileSystem:Register');
        fsa.register(ro.prefix, fs);
      };
    }
  }

  async find(path: string): Promise<FsAwsS3 | null> {
    for (const provider of this.providers) {
      const found = await provider.find(path);
      if (found) return found;
    }
    return null;
  }
}
