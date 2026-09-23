import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';
import { constants, createZstdCompress, createZstdDecompress } from 'node:zlib';

import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';

import { logger } from '../../log.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import { HashTransform } from '../../utils/hash.stream.ts';
import { retryOnError } from '../../utils/retry.ts';
import { registerCli } from '../common.ts';
import { determineTargetFileOperation, fixFileMetadata, statsUpdaters, verifyTargetFile } from './copy-helpers.ts';
import type { CopyContract, CopyContractArgs, CopyStats } from './copy-rpc.ts';
import { FileOperation } from './copy-rpc.ts';

const Q = new ConcurrentQueue(10);
const RetryDelay = 60_000;

export function isZstdError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;

  const errorRecord = error as Record<string, unknown>;
  const code = typeof errorRecord['code'] === 'string' ? errorRecord['code'] : '';
  const message = typeof errorRecord['message'] === 'string' ? errorRecord['message'] : '';

  return code === 'ZSTD_error_prefix_unknown' || message.includes('Unknown frame descriptor');
}

/** Current log id */
let currentId: string | null = null;

export const worker = new WorkerRpc<CopyContract>({
  async copy(args: CopyContractArgs): Promise<CopyStats> {
    const stats: CopyStats = {
      copied: { count: 0, bytesIn: 0, bytesOut: 0 },
      compressed: { count: 0, bytesIn: 0, bytesOut: 0 },
      decompressed: { count: 0, bytesIn: 0, bytesOut: 0 },
      deleted: { count: 0, bytesIn: 0, bytesOut: 0 },
      skipped: { count: 0, bytesIn: 0, bytesOut: 0 },
      processed: { count: 0, bytesIn: 0, bytesOut: 0 },
      total: { count: 0, bytesIn: 0, bytesOut: 0 },
    };

    if (currentId == null) {
      logger.setBindings({ correlationId: args.id, threadId });
      currentId = args.id;
    }

    const end = Math.min(args.start + args.size, args.manifest.length);
    for (let i = args.start; i < end; i++) {
      const manifestEntry = args.manifest[i];
      if (manifestEntry == null) continue;

      Q.push(async () => {
        const startTime = performance.now();
        const sourceLocation = fsa.toUrl(manifestEntry.source);
        const targetLocation = fsa.toUrl(manifestEntry.target);
        const source = await fsa.head(sourceLocation);
        if (source?.size == null || source.size === 0) {
          logger.info({ path: manifestEntry.source }, 'File:Copy:SkippedEmpty');
          statsUpdaters[FileOperation.Skip](stats, source?.size ?? 0);
          return;
        }
        const sourceSize = source.size;

        await retryOnError(
          2,
          () => RetryDelay,
          async (attempt) => {
            if (attempt > 1) {
              logger.info(
                { path: manifestEntry.source, attempt: attempt - 1, retryDelayMs: RetryDelay },
                'File:Copy:Retry:AfterDelay',
              );
            }
            const { target, fileOperation, shouldDeleteSourceOnSuccess } = await determineTargetFileOperation(
              source,
              targetLocation,
              args,
            );
            let targetVerified = false;

            try {
              if (fileOperation !== FileOperation.Skip) {
                logger.info(
                  {
                    path: manifestEntry.source,
                    size: sourceSize,
                    fileOperation,
                    shouldDeleteSourceOnSuccess,
                  },
                  'File:Copy:Start:' + fileOperation,
                );
                const hashOriginal = new HashTransform('sha256');
                const hashCompressed = new HashTransform('sha256');

                const rawSourceStream = fsa.readStream(sourceLocation);
                let sourceStream = rawSourceStream;

                const shouldCompress = fileOperation === FileOperation.Compress;
                const shouldDecompress = fileOperation === FileOperation.Decompress;
                const shouldFixMetadata = args.fixContentType || shouldDecompress || shouldCompress;

                switch (fileOperation) {
                  case FileOperation.Copy:
                    sourceStream = rawSourceStream.pipe(hashOriginal);
                    break;
                  case FileOperation.Compress:
                    const zstdCompress = createZstdCompress({
                      params: {
                        [constants.ZSTD_c_compressionLevel]: 17,
                      },
                    });
                    sourceStream = rawSourceStream.pipe(hashOriginal).pipe(zstdCompress).pipe(hashCompressed);
                    break;
                  case FileOperation.Decompress:
                    const zstdDecompress = createZstdDecompress();
                    sourceStream = rawSourceStream.pipe(hashCompressed).pipe(zstdDecompress).pipe(hashOriginal);
                    break;
                  default:
                    throw new Error(
                      `Unknown file operation [${String(fileOperation)}] for source: ${manifestEntry.source}`,
                    );
                }

                const fileMetadata = shouldFixMetadata ? fixFileMetadata(target.url, source) : source;

                logger.info({ path: manifestEntry.source, size: sourceSize }, 'File:Copy:Write');
                await fsa.write(target.url, sourceStream, fileMetadata);
                logger.info({ path: manifestEntry.source, size: sourceSize }, 'File:Copy:Verify');
                const expectedSize = shouldDecompress
                  ? hashOriginal.size
                  : shouldCompress
                    ? hashCompressed.size
                    : sourceSize;
                const expectedHash = hashOriginal.multihash;
                targetVerified = await verifyTargetFile(target.url, expectedSize, expectedHash);
                if (!targetVerified) {
                  // Cleanup the failed copy so it can be retried
                  await fsa.delete(target.url);
                  throw new Error(
                    `Failed to copy source:${manifestEntry.source} target:${protocolAwareString(target.url)}`,
                  );
                }

                statsUpdaters[fileOperation](stats, sourceSize, expectedSize);
                logger.debug(
                  {
                    ...manifestEntry,
                    fileOperation,
                    size: sourceSize,
                    compressedSize: expectedSize,
                    ratio: ((expectedSize / sourceSize) * 100).toFixed(1) + '%',
                    duration: performance.now() - startTime,
                  },
                  'File:Copy:Done',
                );
              } else {
                logger.info({ path: manifestEntry.source, size: sourceSize }, 'File:Copy:Skipped');
                statsUpdaters[fileOperation](stats, sourceSize);
              }

              if (shouldDeleteSourceOnSuccess && (targetVerified || fileOperation === FileOperation.Skip)) {
                const startTimeDelete = performance.now();
                logger.info({ path: manifestEntry.source }, 'File:DeleteSource:Start');
                await fsa.delete(sourceLocation);
                statsUpdaters[FileOperation.Delete](stats, sourceSize);
                logger.debug(
                  { ...manifestEntry, size: sourceSize, duration: performance.now() - startTimeDelete },
                  'File:DeleteSource:Done',
                );
              }

              return undefined;
            } catch (error) {
              if (attempt < 2 && isZstdError(error)) {
                await fsa.delete(target.url).catch(() => undefined);
                logger.warn(
                  { err: error, path: manifestEntry.source, attempt, retryDelayMs: RetryDelay },
                  'File:Copy:Retry:BeforeDelay',
                );
              }
              throw error;
            }
          },
          (error: unknown) => isZstdError(error),
        );
      });
    }
    await Q.join().catch((err: unknown) => {
      // Composite errors get swallowed when rethrown through worker threads
      logger.fatal({ err }, 'File:Copy:Failed');
      throw err;
    });
    return stats;
  },
});

worker.onStart = (): Promise<void> => {
  registerCli({ name: 'copy:worker' }, {});
  return Promise.resolve();
};

if (parentPort) worker.bind(parentPort);
