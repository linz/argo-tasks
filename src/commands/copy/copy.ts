import { fsa } from '@chunkd/fs';
import { command, number, option, restPositionals, string } from 'cmd-ts';
import { performance } from 'perf_hooks';
import { gunzipSync } from 'zlib';
import * as z from 'zod';
import { logger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { config, registerCli, verbose } from '../common.js';

const CopyValidator = z.object({ source: z.string(), target: z.string() });
const CopyManifest = z.array(CopyValidator);

function tryParse(x: string): unknown {
  if (x.startsWith('[') || x.startsWith('{')) return JSON.parse(x);
  return JSON.parse(gunzipSync(Buffer.from(x, 'base64url')).toString());
}

export const commandCopy = command({
  name: 'copy',
  args: {
    config,
    verbose,
    concurrency: option({ type: number, long: 'concurrency', defaultValue: () => 10 }),
    manifest: restPositionals({ type: string, displayName: 'location', description: 'Manifest of file to copy' }),
  },
  handler: async (args) => {
    registerCli(args);

    const queue = new ConcurrentQueue(args.concurrency);

    for (const m of args.manifest) {
      const manifest = CopyManifest.parse(tryParse(m));
      for (const todo of manifest) {
        queue.push(async () => {
          const exists = await fsa.head(todo.target);
          if (exists) throw new Error('Cannot overwrite file: ' + todo.target + ' source:' + todo.source);
          logger.debug(todo, 'File:Copy:start');
          const startTime = performance.now();
          await fsa.write(todo.target, fsa.stream(todo.source));
          logger.debug({ ...todo, duration: startTime - performance.now() }, 'File:Copy');
        });
      }
    }

    await queue.join();
  },
});
