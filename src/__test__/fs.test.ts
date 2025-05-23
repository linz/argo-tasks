import { after, before, beforeEach, describe, it } from 'node:test';

import { CompositeError } from '@chunkd/core';
import type { FileSystemAbstraction } from '@chunkd/fs';
import { fsa } from '@chunkd/fs';
import type { FsAwsS3 } from '@chunkd/source-aws';
import type { S3LikeV3 } from '@chunkd/source-aws-v3';
import { FsMemory } from '@chunkd/source-memory';
import type { InitializeMiddleware, MetadataBearer } from '@smithy/types';
import assert from 'assert';

import { registerFileSystem } from '../fs.register.ts';

export class HttpError extends Error {
  statusCode: number;
  constructor(code: number, msg: string) {
    super(msg);
    this.statusCode = code;
  }
}

describe('Register', () => {
  const seenBuckets = new Set();
  const throw403: InitializeMiddleware<object, MetadataBearer> = () => {
    return async (args: unknown) => {
      const inp = args as { input: { Bucket?: string } };
      const bucket = inp.input.Bucket;
      if (seenBuckets.has(bucket)) throw new HttpError(418, `Bucket: ${bucket} read multiple`);
      seenBuckets.add(bucket);
      throw new HttpError(403, 'Something');
    };
  };
  const throw403Init = {
    name: 'throw403',
    step: 'initialize',
    priority: 'high',
  } as const;

  /** find all the file systems related to s3:// */
  const fsSystemsPath = (): string[] => {
    fsa.get('s3://', 'r'); // ensure systems' array is sorted
    return fsa.systems.filter((f) => f.path.startsWith('s3://')).map((f) => f.path);
  };

  // Because these tests modify the singleton "fsa" backup the starting systems then restore them
  // after all the tests are finished
  const oldSystems: FileSystemAbstraction['systems'] = [];
  before(() => oldSystems.push(...fsa.systems));
  after(() => (fsa.systems = oldSystems));

  beforeEach(async () => {
    fsa.systems.length = 0;

    seenBuckets.clear();

    const fsMem = new FsMemory();

    fsa.register('memory://', fsMem);
    const config = {
      prefixes: [
        // `_` is not a valid bucket name
        { type: 's3', prefix: 's3://_linz-topographic/', roleArn: 'a' },
        { type: 's3', prefix: 's3://_linz-topographic-upload/', roleArn: 'a' },
      ],
      v: 2,
    };
    await fsa.write('memory://config.json', JSON.stringify(config));
  });

  it('should add both middleware', async () => {
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });
    await s3Fs.credentials.find('s3://_linz-topographic/foo.json');

    const fileSystems = [...s3Fs.credentials.fileSystems.values()];
    assert.equal(fileSystems.length, 1);
    const newFs = fileSystems[0]!.s3 as S3LikeV3;
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
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });
    assert.equal(
      s3Fs.client.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );

    await s3Fs.credentials.find('s3://_linz-topographic/foo.json');
    await s3Fs.credentials.find('s3://_linz-topographic-upload/foo.json');

    const fileSystems = [...s3Fs.credentials.fileSystems.values()];
    assert.equal(fileSystems.length, 1);
    const newFs = fileSystems[0]!.s3 as S3LikeV3;

    assert.deepEqual(
      newFs.client.middlewareStack.identify().filter((f) => f.startsWith('FQDN -')),
      ['FQDN - finalizeRequest'],
    );
  });

  it('should register on 403', async () => {
    assert.equal(fsa.systems.length, 1);
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });
    s3Fs.client.middlewareStack.add(throw403, throw403Init);
    assert.deepEqual(fsSystemsPath(), ['s3://']);

    s3Fs.credentials.onFileSystemCreated = (_ac, fs): void => {
      const fsS3 = fs as FsAwsS3;
      const s3 = fsS3.s3 as S3LikeV3;
      s3.client.middlewareStack.add(throw403);
    };

    const ret = await fsa.read('s3://_linz-topographic/foo.json').catch((e: Error) => e);
    assert.equal(String(ret), 'CompositeError: Failed to read: "s3://_linz-topographic/foo.json"');
    assert.equal(CompositeError.isCompositeError(ret), true);
    const ce = ret as CompositeError;
    assert.equal(ce.code, 418);
  });

  it('should register all buckets', async (t) => {
    assert.equal(fsa.systems.length, 1);
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });

    // All requests to s3 will error with http 403
    s3Fs.client.middlewareStack.add(throw403, throw403Init);

    const fakeTopo = new FsMemory();
    await fakeTopo.write('s3://_linz-topographic/foo.json', 's3://_linz-topographic/foo.json');
    t.mock.method(s3Fs.credentials, 'createFileSystem', () => fakeTopo);

    assert.deepEqual(fsSystemsPath(), ['s3://']);

    const ret = await fsa.read('s3://_linz-topographic/foo.json');

    assert.equal(String(ret), 's3://_linz-topographic/foo.json');
    assert.deepEqual(fsSystemsPath(), ['s3://_linz-topographic/', 's3://']);

    await fsa.exists('s3://_linz-topographic-upload/foo.json');
    assert.deepEqual(fsSystemsPath(), ['s3://_linz-topographic-upload/', 's3://_linz-topographic/', 's3://']);
  });
});
