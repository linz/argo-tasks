import { after, before, beforeEach, describe, it } from 'node:test';

import { FileSystemAbstraction, fsa } from '@chunkd/fs';
import { S3LikeV3 } from '@chunkd/source-aws-v3';
import { FsMemory } from '@chunkd/source-memory';
import { FinalizeRequestMiddleware, MetadataBearer } from '@smithy/types';
import assert from 'assert';

import { registerFileSystem } from '../fs.register.js';

export class HttpError extends Error {
  statusCode: number;
  constructor(code: number, msg: string) {
    super(msg);
    this.statusCode = code;
  }
}

describe('Register', () => {
  const seenBuckets = new Set();
  const throw403: FinalizeRequestMiddleware<object, MetadataBearer> = () => {
    return async (args: { input: { Bucket?: string } }) => {
      const bucket = args.input['Bucket'];
      if (seenBuckets.has(bucket)) throw new HttpError(500, `Bucket: ${bucket} read multiple`);
      seenBuckets.add(bucket);
      throw new HttpError(403, 'Something');
    };
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

    assert.equal(
      newFs.client.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );
  });

  it('should register all buckets', async (t) => {
    assert.equal(fsa.systems.length, 1);
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });

    // All requests to s3 will error with http 403
    s3Fs.client.middlewareStack.add(throw403, { name: 'throw403', step: 'build' });
    s3Fs.credentials.registerConfig('memory://config', fsa);

    const fakeTopo = new FsMemory();
    await fakeTopo.write('s3://_linz-topographic/foo.json', 's3://_linz-topographic/foo.json');

    t.mock.method(s3Fs.credentials, 'createFileSystem', () => fakeTopo);

    assert.equal(
      fsa.systems.find((f) => f.path === 's3://_linz-topographic/'),
      undefined,
    );
    assert.equal(
      fsa.systems.find((f) => f.path === 's3://_linz-topographic-upload/'),
      undefined,
    );

    const ret = await fsa.read('s3://_linz-topographic/foo.json');

    assert.equal(String(ret), 's3://_linz-topographic/foo.json');
    assert.ok(fsa.systems.find((f) => f.path === 's3://_linz-topographic/'));
    assert.equal(
      fsa.systems.find((f) => f.path === 's3://_linz-topographic-upload/'),
      undefined,
    );

    await fsa.exists('s3://_linz-topographic-upload/foo.json');
    assert.ok(fsa.systems.find((f) => f.path === 's3://_linz-topographic-upload/'));
  });
});
