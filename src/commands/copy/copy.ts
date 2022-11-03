import { fsa } from '@chunkd/fs';
import { boolean, command, flag, number, option, restPositionals, string } from 'cmd-ts';
import { performance } from 'perf_hooks';
import { gunzipSync } from 'zlib';
import * as z from 'zod';
import timers from 'timers/promises';
import { logger, logId } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { config, registerCli, verbose } from '../common.js';
import { S3ActionCopy } from '../../utils/s3.action.js';

import { WorkerRpcPool } from '@wtrpc/core';
import { CopyContract } from './copy-rpc.js';

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
  if (x.startsWith('s3://') || x.startsWith('./') || x.startsWith('/')) {
    const json = await fsa.readJson<S3ActionCopy>(x);
    if (json.action !== 'copy') throw new Error('Invalid action: ' + json.action + ' from:' + x);
    return json.parameters.manifest;
  }
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
    concurrency: option({ type: number, long: 'concurrency', defaultValue: () => 4 }),
    manifest: restPositionals({ type: string, displayName: 'location', description: 'Manifest of file to copy' }),
  },
  handler: async (args) => {
    registerCli(args);

    const workerUrl = new URL('./copy-worker.js', import.meta.url);
    console.log(args.concurrency);
    const pool = new WorkerRpcPool<CopyContract>(args.concurrency, workerUrl);

    const stats = { copied: 0, copiedBytes: 0, retries: 0, skipped: 0, skippedBytes: 0 };

    const chunks = [];
    const startTime = performance.now();
    for (const m of args.manifest) {
      const data = await tryParse(m);
      const manifest = CopyManifest.parse(data);

      const chunkSize = manifest.length / args.concurrency;
      for (let i = 0; i < manifest.length; i += chunkSize) {
        chunks.push(
          pool.run('copy', {
            id: logId,
            manifest,
            start: i,
            size: chunkSize,
            force: args.force,
            noClobber: args.noClobber,
          }),
        );
      }
    }

    const results = await Promise.all(chunks);
    for (const result of results) {
      stats.copied += result.copied;
      stats.copiedBytes += result.copiedBytes;
      stats.skipped += result.skipped;
      stats.skippedBytes += result.skippedBytes;
    }

    await pool.close();
    logger.info({ copyStats: stats, duration: performance.now() - startTime }, 'File:Copy:Done');
  },
});
