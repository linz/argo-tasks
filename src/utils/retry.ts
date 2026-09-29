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
