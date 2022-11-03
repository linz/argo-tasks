import { PrettyTransform } from 'pretty-json-log';
import pino from 'pino';
import ulid from 'ulid';

const baseLogger = process.stdout.isTTY ? pino(PrettyTransform.stream()) : pino();

export const logId = ulid.ulid();

export const logger = baseLogger.child({ id: logId });
logger.level = 'debug';

export function registerLogger(cfg: { verbose?: boolean }): void {
  if (cfg.verbose) logger.level = 'trace';
}
