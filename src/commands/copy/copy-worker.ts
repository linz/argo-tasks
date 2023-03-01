import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';
import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';
import { baseLogger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { registerCli } from '../common.js';
import { CopyContract, CopyContractArgs, CopyStats } from './copy-rpc.js';

const Q = new ConcurrentQueue(10);

/**
 * S3 Writes do not always show up instantly as we have read the location earlier in the function
 *
 * try reading the path {retryCount} times before aborting, with a delay of 250ms between requests
 *
 * @param filePath File to head
 * @param retryCount number of times to retry
 * @returns file size if it exists or null
 */
async function tryHead(filePath: string, retryCount = 3): Promise<number | null> {
  for (let i = 0; i < retryCount; i++) {
    const ret = await fsa.head(filePath);
    if (ret?.size) return ret.size;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const worker = new WorkerRpc<CopyContract>({
  async copy(args: CopyContractArgs): Promise<CopyStats> {
    const stats: CopyStats = { copied: 0, copiedBytes: 0, retries: 0, skipped: 0, skippedBytes: 0 };
    const end = Math.min(args.start + args.size, args.manifest.length);
    const log = baseLogger.child({ id: args.id, threadId });

    for (let i = args.start; i < end; i++) {
      const todo = args.manifest[i];
      if (todo == null) continue;

      Q.push(async () => {
        const [source, target] = await Promise.all([fsa.head(todo.source), fsa.head(todo.target)]);
        if (source == null) return;
        if (source.size == null) return;
        if (target != null) {
          if (source?.size === target.size && args.noClobber) {
            log.info({ path: todo.target, size: target.size }, 'File:Copy:Skipped');
            stats.skipped++;
            stats.skippedBytes += source.size;
            return;
          }

          if (!args.force) {
            log.error({ target: target.path, source: source.path }, 'File:Overwrite');
            throw new Error('Cannot overwrite file: ' + todo.target + ' source:' + todo.source);
          }
        }

        log.trace(todo, 'File:Copy:start');
        const startTime = performance.now();
        await fsa.write(todo.target, fsa.stream(todo.source));

        // Validate the file moved successfully
        const targetSize = await tryHead(todo.target);
        if (targetSize !== source.size) {
          log.fatal({ ...todo }, 'Copy:Failed');
          throw new Error(`Failed to copy source:${todo.source} target:${todo.target}`);
        }
        log.debug({ ...todo, size: targetSize, duration: performance.now() - startTime }, 'File:Copy');

        stats.copied++;
        stats.copiedBytes += source.size;
      });
    }
    await Q.join().catch((err) => {
      // Composite errors get swallowed when rethrown through worker threads
      log.fatal({ err }, 'File:Copy:Failed');
      throw err;
    });
    return stats;
  },
});

worker.onStart = async (): Promise<void> => {
  registerCli({});
};

if (parentPort) worker.bind(parentPort);
