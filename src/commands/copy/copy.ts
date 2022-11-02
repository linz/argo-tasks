import { fsa } from '@chunkd/fs';
import { boolean, command, flag, number, option, restPositionals, string } from 'cmd-ts';
import { performance } from 'perf_hooks';
import { gunzipSync } from 'zlib';
import * as z from 'zod';
import timers from 'timers/promises';
import { logger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { config, registerCli, verbose } from '../common.js';

const CopyValidator = z.object({ source: z.string(), target: z.string() });
type CopyTodo = z.infer<typeof CopyValidator>;
const CopyManifest = z.array(CopyValidator);

/**
 * Attempt to figure out how the configuration is pass to us
 * - Could be a path to a S3 location s3://foo/bar.json
 * - Could be a JSON document "[{}]"
 * - Could be a Base64'd Gzipped document
 */
async function tryParse(x: string): Promise<unknown> {
  if (x.startsWith('s3://') || x.startsWith('./') || x.startsWith('/')) return fsa.readJson(x);
  if (x.startsWith('[') || x.startsWith('{')) return JSON.parse(x);
  return JSON.parse(gunzipSync(Buffer.from(x, 'base64url')).toString());
}

export const commandCopy = command({
  name: 'copy',
  args: {
    config,
    verbose,
    force: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'force',
      description: 'Overwrite existing files',
    }),
    noClobber: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'no-clobber',
      description: 'Skip existing files',
    }),
    concurrency: option({ type: number, long: 'concurrency', defaultValue: () => 10 }),
    manifest: restPositionals({ type: string, displayName: 'location', description: 'Manifest of file to copy' }),
  },
  handler: async (args) => {
    registerCli(args);

    const queue = new ConcurrentQueue(args.concurrency);

    for (const m of args.manifest) {
      const data = await tryParse(m);
      const manifest = CopyManifest.parse(data);
      for (const todo of manifest) {
        queue.push(async () => {
          const exists = await fsa.head(todo.target);
          if (exists && args.noClobber) {
            const head = await fsa.head(todo.source);
            if (head?.size === exists.size) {
              logger.info({ path: todo.target, size: exists.size }, 'File:Copy:Skipped');
              return;
            }
          }
          if (exists && !args.force) {
            throw new Error('Cannot overwrite file: ' + todo.target + ' source:' + todo.source);
          }
          // Retry upto three times
          for (let i = 0; i < 3; i++) {
            try {
              return await copyFile(todo);
            } catch (e) {
              logger.warn({ err: e }, 'File:Copy:Retry');
              await timers.setTimeout(1000 * (i + 1));
            }
          }
        });
      }
    }

    await queue.join();
  },
});

async function copyFile(todo: CopyTodo): Promise<void> {
  logger.debug(todo, 'File:Copy:start');
  const startTime = performance.now();
  await fsa.write(todo.target, fsa.stream(todo.source));
  logger.debug({ ...todo, duration: performance.now() - startTime }, 'File:Copy');
}
