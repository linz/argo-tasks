import { setTimeout as delay } from 'node:timers/promises';

import { logger } from '../log.ts';

export async function retryOnError<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  for (let i = 1; i <= 3; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === 3 || !shouldRetry(error)) throw error;
      logger.info({ err: error, attempt: i, retryDelayMs: 10_000 }, 'Retry:Operation:Failed');
      await delay(10_000);
    }
  }

  throw new Error('Retry attempts exhausted');
}
