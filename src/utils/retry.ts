import { setTimeout as delay } from 'node:timers/promises';

import { logger } from '../log.ts';

export async function retryOnError<T>(
  maxTries: number,
  delayMs: (attempt: number) => number,
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  context?: Record<string, unknown>,
): Promise<T> {
  for (let i = 1; i <= maxTries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxTries || !shouldRetry(error)) throw error;
      const delayTime = delayMs(i);
      logger.info({ ...context, err: error, attempt: i, retryDelayMs: delayTime }, 'Retry:Operation:Failed');
      await delay(delayTime);
    }
  }

  throw new Error('Retry attempts exhausted');
}

/** Network error codes that are safe to retry */
const TransientNetworkErrorCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE']);

/**
 * Whether an error is a network error worth retrying
 *
 * Checks `code` on the error itself (e.g. a Node.js network error)
 * and on its `cause` (e.g. a `FsError` from `@chunkd/fs` wrapping a network error)
 */
export function isTransientNetworkError(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false;
  const err = e as { code?: unknown; cause?: { code?: unknown } };
  for (const code of [err.code, err.cause?.code]) {
    if (typeof code === 'string' && TransientNetworkErrorCodes.has(code)) return true;
  }
  return false;
}
