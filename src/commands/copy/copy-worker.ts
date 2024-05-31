import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';

import { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';
import { createHash } from 'crypto';

import { baseLogger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { HashKey } from '../../utils/hash.js';
import { registerCli } from '../common.js';
import { isTiff } from '../tileindex-validate/tileindex.validate.js';
import { CopyContract, CopyContractArgs, CopyStats } from './copy-rpc.js';
import { HashTransform } from './hash.stream.js';

const Q = new ConcurrentQueue(10);

export const FixableContentType = new Set(['binary/octet-stream', 'application/octet-stream']);

/**
 * If the file has been written with a unknown binary contentType attempt to fix it with common content types
 *
 *
 * @param path File path to fix the metadata of
 * @param meta File metadata
 * @returns New fixed file metadata if fixed other wise source file metadata
 */
export function fixFileMetadata(path: string, meta: FileInfo): FileInfo {
  // If the content is encoded we do not know what the content-type should be
  if (meta.contentEncoding != null) return meta;
  if (!FixableContentType.has(meta.contentType ?? 'binary/octet-stream')) return meta;

  // Assume our tiffs are cloud optimized
  if (isTiff(path)) return { ...meta, contentType: 'image/tiff; application=geotiff; profile=cloud-optimized' };

  // overwrite with application/json
  if (path.endsWith('.json')) return { ...meta, contentType: 'application/json' };

  return meta;
}

/**
 * S3 Writes do not always show up instantly as we have read the location earlier in the function
 *
 * try reading the path {retryCount} times before aborting, with a delay of 250ms between requests
 *
 * @param filePath File to head
 * @param retryCount number of times to retry
 * @returns FileInfo if it exists or null
 */
async function tryHead(filePath: string, retryCount = 3): Promise<FileInfo | null> {
  for (let i = 0; i < retryCount; i++) {
    const ret = await fsa.head(filePath);
    if (ret) return ret;
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
        if (target != null && source.metadata && target.metadata) {
          if (source?.size === target.size && source.metadata[HashKey] === target.metadata[HashKey] && args.noClobber) {
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

        const sourceStream = fsa.stream(todo.source).pipe(new HashTransform('sha256'));

        log.trace(todo, 'File:Copy:start');
        const startTime = performance.now();

        await fsa.write(todo.target, sourceStream, args.fixContentType ? fixFileMetadata(todo.source, source) : source);

        // Validate the file moved successfully
        const targetInfo = await tryHead(todo.target);
        let targetHash;
        if (targetInfo?.metadata) {
          targetHash = targetInfo.metadata[HashKey];
        } else if (!todo.target.startsWith('s3://')) {
          const buf = await fsa.read(todo.target);
          // Multihash header 0x12 - Sha256 0x20 - 32 bits of hex digest
          targetHash = '1220' + createHash('sha256').update(buf).digest('hex');
        }

        if (targetInfo?.size !== source.size || targetHash !== sourceStream.multihash) {
          log.fatal({ ...todo }, 'Copy:Failed');
          // Cleanup the failed copy so it can be retried
          if (targetInfo?.size != null) await fsa.delete(todo.target);
          throw new Error(`Failed to copy source:${todo.source} target:${todo.target}`);
        }
        log.debug({ ...todo, size: targetInfo.size, duration: performance.now() - startTime }, 'File:Copy');

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
