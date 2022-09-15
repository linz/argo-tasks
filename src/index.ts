import { otError } from '@linzjs/tracing';
import { run } from 'cmd-ts';
import { cmd } from './commands/index.js';
import { logger } from './log.js';

run(cmd, process.argv.slice(2)).catch((err) => {
  logger.fatal('Command:Failed', { ...otError(err) });
  logger.pino.flush();
  // Give the logger some time to flush before exiting
  setTimeout(() => process.exit(1), 25);
});
