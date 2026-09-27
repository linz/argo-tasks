import assert from 'node:assert';
import { describe, it } from 'node:test';

import { retryOnError } from '../retry.ts';

describe('retryOnError', () => {
  it('should retry until the operation succeeds', async () => {
    let attempts = 0;

    const result = await retryOnError(
      3,
      () => 0,
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

  it('should stop retrying when shouldRetry returns false', async () => {
    let attempts = 0;

    await assert.rejects(
      retryOnError(
        3,
        () => 0,
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
