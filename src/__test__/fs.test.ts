import { after, before, beforeEach, describe, it } from 'node:test';

import { fsa, FsError, FsMemory } from '@chunkd/fs';
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
    fsa.get(fsa.toUrl('s3://'), 'r'); // ensure systems' array is sorted
    return fsa.systems.filter((f) => f.prefix.startsWith('s3://')).map((f) => f.prefix);
  };

  // Because these tests modify the singleton "fsa" backup the starting systems then restore them
  // after all the tests are finished
  const oldSystems: (typeof fsa)['systems'] = [];
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
    await fsa.write(fsa.toUrl('memory://config.json'), JSON.stringify(config));
  });

  it('should add both middleware', async () => {
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });
    await s3Fs.credentials!.find(new URL('s3://_linz-topographic/foo.json'));

    const fileSystems = [...s3Fs.credentials!.fileSystems.values()];
    assert.equal(fileSystems.length, 1);
    const newFs = fileSystems[0]!;
    assert.equal(
      newFs.s3.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );
    assert.equal(
      newFs.s3.middlewareStack.identify().find((f) => f.startsWith('EAI_AGAIN -')),
      'EAI_AGAIN - build',
    );
  });

  it('should not duplicate middleware', async () => {
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });
    assert.equal(
      s3Fs.s3.middlewareStack.identify().find((f) => f.startsWith('FQDN -')),
      'FQDN - finalizeRequest',
    );
    await s3Fs.credentials!.find(new URL('s3://_linz-topographic/foo.json'));
    await s3Fs.credentials!.find(new URL('s3://_linz-topographic-upload/foo.json'));

    const fileSystems = [...s3Fs.credentials!.fileSystems.values()];
    assert.equal(fileSystems.length, 1);
    const newFs = fileSystems[0]!.s3;

    assert.deepEqual(
      newFs.middlewareStack.identify().filter((f) => f.startsWith('FQDN -')),
      ['FQDN - finalizeRequest'],
    );
  });

  it('should register on 403', async () => {
    assert.equal(fsa.systems.length, 1);
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });
    s3Fs.s3.middlewareStack.add(throw403, throw403Init);
    assert.deepEqual(fsSystemsPath(), ['s3://']);
    if (s3Fs.credentials == null) throw new Error('No credentials');
    s3Fs.credentials.onFileSystemCreated = (_ac, fs): void => {
      const s3 = fs.s3;
      s3.middlewareStack.add(throw403);
    };

    const ret = await fsa.read(fsa.toUrl('s3://_linz-topographic/foo.json')).catch((e: Error) => e);
    assert.equal(String(ret), 'Error: Failed to read: "s3://_linz-topographic/foo.json"');
    assert.equal(ret instanceof Error, true);

    assert.equal(FsError.is(ret), true);
    const fse = ret as FsError;
    assert.equal(fse.code, 418);
  });

  it('should register all buckets', async (t) => {
    assert.equal(fsa.systems.length, 1);
    const s3Fs = registerFileSystem({ config: 'memory://config.json' });

    // All requests to s3 will error with http 403
    s3Fs.s3.middlewareStack.add(throw403, throw403Init);

    const fakeTopo = new FsMemory();
    await fakeTopo.write(fsa.toUrl('s3://_linz-topographic/foo.json'), 's3://_linz-topographic/foo.json');
    t.mock.method(s3Fs.credentials!, 'createFileSystem', () => fakeTopo);

    assert.deepEqual(fsSystemsPath(), ['s3://']);

    const ret = await fsa.read(fsa.toUrl('s3://_linz-topographic/foo.json'));

    assert.equal(String(ret), 's3://_linz-topographic/foo.json');
    assert.deepEqual(fsSystemsPath(), ['s3://_linz-topographic/', 's3://']);

    await fsa.exists(fsa.toUrl('s3://_linz-topographic-upload/foo.json'));
    assert.deepEqual(fsSystemsPath(), ['s3://_linz-topographic-upload/', 's3://_linz-topographic/', 's3://']);
  });
});
