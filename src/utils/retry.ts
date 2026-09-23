import { setTimeout as delay } from 'node:timers/promises';

export async function retryOnError<T>(
  attempts: number,
  delayMs: (attempt: number) => number,
  operation: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown, attempt: number) => boolean,
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === attempts || !shouldRetry(error, attempt)) throw error;
      await delay(delayMs(attempt));
    }
  }

  throw new Error('Retry attempts exhausted');
}