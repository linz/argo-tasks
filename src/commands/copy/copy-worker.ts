import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';

import { FileInfo, fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';

import { baseLogger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { registerCli } from '../common.js';
import { isTiff } from '../tileindex-validate/tileindex.validate.js';
import { CopyContract, CopyContractArgs, CopyStats } from './copy-rpc.js';

const Q = new ConcurrentQueue(10);

export const FixableContentType = new Set(['binary/octet-stream', 'application/octet-stream']);

/**
 * If the file has been written with a unknown binary contentType attempt to fix it with common content types
 *
 *
 * @param url File path to fix the metadata of
 * @param meta File metadata
 * @returns New fixed file metadata if fixed other wise source file metadata
 */
export function fixFileMetadata(url: URL, meta: FileInfo): FileInfo {
  // If the content is encoded we do not know what the content-type should be
  if (meta.contentEncoding != null) return meta;
  if (!FixableContentType.has(meta.contentType ?? 'binary/octet-stream')) return meta;

  // Assume our tiffs are cloud optimized
  if (isTiff(url)) return { ...meta, contentType: 'image/tiff; application=geotiff; profile=cloud-optimized' };

  // overwrite with application/json
  if (url.href.endsWith('.json')) return { ...meta, contentType: 'application/json' };

  return meta;
}

/**
 * S3 Writes do not always show up instantly as we have read the location earlier in the function
 *
 * try reading the path {retryCount} times before aborting, with a delay of 250ms between requests
 *
 * @param url File to head
 * @param retryCount number of times to retry
 * @returns file size if it exists or null
 */
async function tryHead(url: URL, retryCount = 3): Promise<number | null> {
  for (let i = 0; i < retryCount; i++) {
    const ret = await fsa.head(url);
    if (ret?.size) return ret.size;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export const worker = new WorkerRpc<CopyContract>({
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
            log.error({ target: target, source: source }, 'File:Overwrite');
            throw new Error('Cannot overwrite file: ' + todo.target + ' source:' + todo.source);
          }
        }

        log.trace(todo, 'File:Copy:start');
        const startTime = performance.now();
        await fsa.write(
          todo.target,
          fsa.readStream(todo.source),
          args.fixContentType ? fixFileMetadata(todo.source, source) : source,
        );

        // Validate the file moved successfully
        const targetSize = await tryHead(todo.target);
        if (targetSize !== source.size) {
          log.fatal({ ...todo }, 'Copy:Failed');
          // Cleanup the failed copy so it can be retried
          if (targetSize != null) await fsa.delete(todo.target);
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
  registerCli({ name: 'copy:worker' }, {});
};

if (parentPort) worker.bind(parentPort);
