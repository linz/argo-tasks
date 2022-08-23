import { run } from 'cmd-ts';
import { cmd } from './commands/index.js';

run(cmd, process.argv.slice(2));
