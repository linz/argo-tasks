import { pino } from 'pino';
import { PrettyTransform } from 'pretty-json-log';
import ulid from 'ulid';

export const baseLogger = process.stdout.isTTY ? pino(PrettyTransform.stream()) : pino();
baseLogger.level = 'debug';

export const logId = ulid.ulid();

export const logger = baseLogger.child({ id: logId });

export function registerLogger(cfg: { verbose?: boolean }): void {
  if (cfg.verbose) logger.level = 'trace';
}
