// Ensure connection reuse is enabled
process.env['AWS_NODEJS_CONNECTION_REUSE_ENABLED'] = '1';

import { run } from 'cmd-ts';

import { cmd } from './commands/index.js';
import { logger } from './log.js';

const startTime = performance.now();
run(cmd, process.argv.slice(2))
  .then(() => {
    logger.debug({ duration: performance.now() - startTime }, 'Command:Done');
  })
  .catch((err) => {
    logger.fatal({ err }, 'Command:Failed');
    logger.flush();
    // Give the logger some time to flush before exiting
    setTimeout(() => process.exit(1), 25);
  });
