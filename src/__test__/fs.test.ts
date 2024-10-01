import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsAwsS3V3 } from '@chunkd/source-aws-v3';
import { FsMemory } from '@chunkd/source-memory';
import assert from 'assert';

import { setupS3FileSystem } from '../fs.register.js';

export class HttpError extends Error {
  statusCode: number;
  constructor(code: number, msg: string) {
    super(msg);
    this.statusCode = code;
  }
}

describe('Register', () => {
  beforeEach(async () => {
    const fsMem = new FsMemory();
    fsa.register('memory://', fsMem);
    const config = {
      prefixes: [
        { type: 's3', prefix: 's3://linz-topographic/', roleArn: 'a' },
        { type: 's3', prefix: 's3://linz-topographic-upload/', roleArn: 'a' },
      ],
      v: 2,
    };
    await fsa.write('memory://config', JSON.stringify(config));
  });

  it('should add both middleware', async () => {
    const s3Fs = new FsAwsS3V3();
    setupS3FileSystem(s3Fs);

    const newFs = new FsAwsS3V3();
    s3Fs.credentials?.onFileSystemCreated?.({ type: 's3', prefix: 's3://linz-topographic/', roleArn: 'a' }, newFs);
    assert.equal(
      newFs.client.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );
    assert.equal(
      newFs.client.middlewareStack.identify().find((f) => f.startsWith('EAI_AGAIN -')),
      'EAI_AGAIN - build',
    );
  });

  it('should not duplicate middleware', async () => {
    const s3Fs = new FsAwsS3V3();
    setupS3FileSystem(s3Fs);
    assert.equal(
      s3Fs.client.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );

    s3Fs.credentials?.onFileSystemCreated?.({ type: 's3', prefix: 's3://linz-topographic/', roleArn: 'a' }, s3Fs);
    assert.equal(
      s3Fs.client.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );
  });
});
