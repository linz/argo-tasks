import { fsa } from '@chunkd/fs';
import { command, restPositionals, string } from 'cmd-ts';
import * as z from 'zod';
import { logger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { config, registerCli, verbose } from '../common.js';

const CopyValidator = z.object({ source: z.string(), target: z.string() });
const CopyManifest = z.array(CopyValidator);

export const commandCopy = command({
  name: 'copy',
  args: {
    config,
    verbose,
    manifest: restPositionals({ type: string, displayName: 'location', description: 'Manifest of file to copy' }),
  },
  handler: async (args) => {
    registerCli(args);

    const queue = new ConcurrentQueue(50);

    for (const m of args.manifest) {
      const manifest = CopyManifest.parse(JSON.parse(m));
      for (const todo of manifest) {
        queue.push(async () => {
          const exists = await fsa.head(todo.target);
          if (exists) throw new Error('Cannot overwrite file: ' + todo.target + ' source:' + todo.source);
          logger.info(todo, 'File:Copy');
          await fsa.write(todo.target, fsa.stream(todo.source));
        });
      }
    }

    await queue.join();
  },
});
