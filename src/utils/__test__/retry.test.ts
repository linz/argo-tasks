import assert from 'node:assert';
import { describe, it } from 'node:test';

import { retryOnError } from '../retry.ts';

describe('retryOnError', () => {
  it('should retry until the operation succeeds', async () => {
    let attempts = 0;

    const result = await retryOnError(
      3,
      () => 10,
      () => {
        attempts += 1;
        if (attempts < 3) return Promise.reject(new Error('temporary failure'));
        return Promise.resolve('ok');
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
        () => {
          attempts += 1;
          return Promise.reject(new Error(`failure ${attempts}`));
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
        () => {
          attempts += 1;
          return Promise.reject(new Error('permanent failure'));
        },
        () => false,
      ),
      { message: 'permanent failure' },
    );

    assert.equal(attempts, 1);
  });
});
