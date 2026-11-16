import { FsError, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { describe, it } from 'node:test';

import { isTransientNetworkError, retryOnError } from '../retry.ts';

describe('retryOnError', () => {
  it('should retry until the operation succeeds', async () => {
    let attempts = 0;

    const result = await retryOnError(
      3,
      () => 10,
      // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('temporary failure');
        return 'ok';
      },
      () => true,
    );

    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
  });

  it('should wait a fixed delay between attempts and rethrow the last error', async () => {
    let attempts = 0;
    const start = performance.now();

    await assert.rejects(
      retryOnError(
        3,
        () => 10,
        // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
        async () => {
          attempts += 1;
          throw new Error(`failure ${attempts}`);
        },
        () => true,
      ),
      { message: 'failure 3' },
    );

    assert.equal(attempts, 3);
    assert.ok(performance.now() - start >= 20, 'waits about 10 milliseconds after each of the first two attempts');
  });

  it('should stop retrying when shouldRetry returns false', async () => {
    let attempts = 0;

    await assert.rejects(
      retryOnError(
        3,
        () => 10,
        // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
        async () => {
          attempts += 1;
          throw new Error('permanent failure');
        },
        () => false,
      ),
      { message: 'permanent failure' },
    );

    assert.equal(attempts, 1);
  });
});

describe('retryOnError', () => {
  it('should retry until the operation succeeds', async () => {
    let attempts = 0;

    const result = await retryOnError(
      3,
      () => 10,
      // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('temporary failure');
        return 'ok';
      },
      () => true,
    );

    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
  });

  it('should wait a fixed delay between attempts and rethrow the last error', async () => {
    let attempts = 0;
    const start = performance.now();

    await assert.rejects(
      retryOnError(
        3,
        () => 10,
        // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
        async () => {
          attempts += 1;
          throw new Error(`failure ${attempts}`);
        },
        () => true,
      ),
      { message: 'failure 3' },
    );

    assert.equal(attempts, 3);
    assert.ok(performance.now() - start >= 20, 'waits about 10 milliseconds after each of the first two attempts');
  });

  it('should stop retrying when shouldRetry returns false', async () => {
    let attempts = 0;

    await assert.rejects(
      retryOnError(
        3,
        () => 10,
        // oxlint-disable-next-line typescript/require-await -- throw must become a rejection
        async () => {
          attempts += 1;
          throw new Error('permanent failure');
        },
        () => false,
      ),
      { message: 'permanent failure' },
    );

    assert.equal(attempts, 1);
  });
});

describe('isTransientNetworkError', () => {
  it('should detect a network error code on the error', () => {
    assert.equal(isTransientNetworkError(Object.assign(new Error('aborted'), { code: 'ECONNRESET' })), true);
    assert.equal(isTransientNetworkError({ code: 'ETIMEDOUT' }), true);
  });

  it('should detect a network error code on the cause of a FsError', () => {
    const url = new URL('memory://test/file.tiff');
    const cause = Object.assign(new Error('aborted'), { code: 'ECONNRESET' });
    const error = new FsError('Failed to readStream', 500, url, 'readStream', new FsMemory(), cause);
    assert.equal(isTransientNetworkError(error), true);
  });

  it('should not retry other errors', () => {
    const url = new URL('memory://test/file.tiff');
    assert.equal(isTransientNetworkError(new FsError('Access denied', 403, url, 'read', new FsMemory())), false);
    assert.equal(isTransientNetworkError(new Error('Access denied')), false);
    assert.equal(isTransientNetworkError({ code: 'ZSTD_error_prefix_unknown' }), false);
    assert.equal(isTransientNetworkError(null), false);
  });
});
