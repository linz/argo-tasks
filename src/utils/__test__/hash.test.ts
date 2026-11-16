import { fsa, FsError, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { hashBuffer, hashFile, HashRetry, hashStream } from '../hash.ts';

describe('hashBuffer', () => {
  it('should return the expecting digest', () => {
    const expectingDigest = '12209f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    const digest = hashBuffer(Buffer.from('test'));
    assert.equal(digest, expectingDigest);
  });
});

describe('hashStream', () => {
  it('should return the expecting digest', async () => {
    const expectingDigest = '12209f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    const stream = Readable.from(['test']);
    const digest = await hashStream(stream);
    assert.equal(digest, expectingDigest);
  });
});

describe('hashFile', () => {
  const memory = new FsMemory();
  const source = fsa.toUrl('memory://hash/test.tiff');
  const expectingDigest = '12209f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  before(() => fsa.register('memory://hash/', memory));
  beforeEach(() => memory.files.clear());

  it('should retry after a network error', async (t) => {
    const { delayMs } = HashRetry;
    HashRetry.delayMs = 1;
    t.after(() => {
      HashRetry.delayMs = delayMs;
    });
    await fsa.write(source, Buffer.from('test'));
    const realReadStream = fsa.readStream.bind(fsa);
    let calls = 0;
    t.mock.method(fsa, 'readStream', (loc: URL) => {
      calls++;
      if (calls > 1) return realReadStream(loc);
      const stream = new Readable({ read(): void {} });
      process.nextTick(() =>
        stream.destroy(
          new FsError(
            `Failed to readStream: ${loc.href}`,
            500,
            loc,
            'readStream',
            memory,
            Object.assign(new Error('aborted'), { code: 'ECONNRESET' }),
          ),
        ),
      );
      return stream;
    });

    const digest = await hashFile(source);
    assert.equal(digest, expectingDigest);
    assert.equal(calls, 2);
  });

  it('should retry after a network error that is not wrapped in a FsError', async (t) => {
    const { delayMs } = HashRetry;
    HashRetry.delayMs = 1;
    t.after(() => {
      HashRetry.delayMs = delayMs;
    });
    await fsa.write(source, Buffer.from('test'));
    const realReadStream = fsa.readStream.bind(fsa);
    let calls = 0;
    t.mock.method(fsa, 'readStream', (loc: URL) => {
      calls++;
      if (calls > 1) return realReadStream(loc);
      const stream = new Readable({ read(): void {} });
      process.nextTick(() => stream.destroy(Object.assign(new Error('aborted'), { code: 'ECONNRESET' })));
      return stream;
    });

    const digest = await hashFile(source);
    assert.equal(digest, expectingDigest);
    assert.equal(calls, 2);
  });

  it('should not retry after a non-network error', async (t) => {
    let calls = 0;
    t.mock.method(fsa, 'readStream', () => {
      calls++;
      const stream = new Readable({ read(): void {} });
      process.nextTick(() => stream.destroy(new Error('Access denied')));
      return stream;
    });

    await assert.rejects(hashFile(source), /Access denied/);
    assert.equal(calls, 1);
  });
});
