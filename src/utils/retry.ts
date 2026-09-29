import { setTimeout as delay } from 'node:timers/promises';

import { logger } from '../log.ts';

export async function retryOnError<T>(
  attempts: number,
  delayMs: number | ((attempt: number) => number),
  operation: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown, attempt: number) => boolean,
  logContext: Record<string, unknown> = {},
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === attempts || !shouldRetry(error, attempt)) throw error;
      const retryDelayMs = typeof delayMs === 'number' ? delayMs : delayMs(attempt);
      logger.warn({ ...logContext, err: error, attempt, retryDelayMs }, 'Retry:BeforeDelay');
      await delay(retryDelayMs);
      logger.info({ ...logContext, attempt, retryDelayMs }, 'Retry:AfterDelay');
    }
  }

  throw new Error('Retry attempts exhausted');
}
