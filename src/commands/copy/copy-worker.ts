import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';
import { createZstdCompress } from 'node:zlib';

import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';

import { logger } from '../../log.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { HashTransform } from '../../utils/hash.stream.ts';
import { registerCli } from '../common.ts';
import { fixFileMetadata } from './copy-file-metadata.ts';
import { determineTargetFileOperation, verifyTargetFile } from './copy-helpers.ts';
import type { CopyContract, CopyContractArgs, CopyStats } from './copy-rpc.ts';
import { FileOperation } from './copy-rpc.ts';

const Q = new ConcurrentQueue(10);

/** Current log id */
let currentId: string | null = null;

export const worker = new WorkerRpc<CopyContract>({
  async copy(args: CopyContractArgs): Promise<CopyStats> {
    const stats: CopyStats = {
      copied: 0,
      copiedBytes: 0,
      compressed: 0,
      compressedInputBytes: 0,
      compressedOutputBytes: 0,
      deleted: 0,
      deletedBytes: 0,
      retries: 0,
      skipped: 0,
      skippedBytes: 0,
    };
    const statsUpdaters = {
      [FileOperation.Compress]: ({ sourceSize, outputSize }: { sourceSize: number; outputSize: number }): void => {
        stats.copied++;
        stats.copiedBytes += sourceSize;
        stats.compressed++;
        stats.compressedInputBytes += sourceSize;
        stats.compressedOutputBytes += outputSize;
      },
      [FileOperation.Copy]: ({ sourceSize }: { sourceSize: number }): void => {
        stats.copied++;
        stats.copiedBytes += sourceSize;
      },
      [FileOperation.Skip]: ({ sourceSize }: { sourceSize: number }): void => {
        stats.skipped++;
        stats.skippedBytes += sourceSize;
      },
      [FileOperation.Delete]: ({ sourceSize }: { sourceSize: number }): void => {
        stats.deleted++;
        stats.deletedBytes += sourceSize;
      },
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
        const source = await fsa.head(manifestEntry.source);

        if (source == null || source.size == null || source.size === 0) {
          logger.info({ path: manifestEntry.source }, 'File:Copy:SkippedEmpty');
          statsUpdaters[FileOperation.Skip]({ sourceSize: 0 });
          return;
        }
        const { target, fileOperation, shouldDeleteSourceOnSuccess } = await determineTargetFileOperation(
          source,
          manifestEntry.target,
          args,
        );
        let targetVerified = false;
        if (fileOperation !== FileOperation.Skip) {
          logger.info(
            {
              path: manifestEntry.source,
              size: source.size,
              fileOperation,
              shouldDeleteSourceOnSuccess,
            },
            'File:Copy:Start:' + fileOperation,
          );
          const hashOriginal = new HashTransform('sha256');
          const hashCompressed = new HashTransform('sha256');

          const rawSourceStream = fsa.stream(manifestEntry.source);
          let sourceStream = rawSourceStream;

          const shouldCompress = fileOperation === FileOperation.Compress;
          if (fileOperation === FileOperation.Copy) {
            sourceStream = rawSourceStream.pipe(hashOriginal);
          } else if (shouldCompress) {
            const zstd = createZstdCompress();
            sourceStream = rawSourceStream.pipe(hashOriginal).pipe(zstd).pipe(hashCompressed);
          } else {
            throw new Error(`Unknown file operation [${String(fileOperation)}] for source: ${manifestEntry.source}`);
          }

          logger.info({ path: manifestEntry.source, size: source.size }, 'File:Copy:Write');
          await fsa.write(
            target.path,
            sourceStream,
            args.fixContentType || shouldCompress ? fixFileMetadata(target.path, source) : source,
          );

          logger.info({ path: manifestEntry.source, size: source.size }, 'File:Copy:Verify');
          const expectedSize = shouldCompress ? hashCompressed.size : source.size;
          const expectedHash = hashOriginal.multihash;
          targetVerified = await verifyTargetFile(target.path, expectedSize, expectedHash);
          if (!targetVerified) {
            // Cleanup the failed copy so it can be retried
            await fsa.delete(target.path);
            throw new Error(`Failed to copy source:${manifestEntry.source} target:${target.path}`);
          }

          statsUpdaters[fileOperation]({ sourceSize: source.size, outputSize: expectedSize });
          logger.debug(
            {
              ...manifestEntry,
              fileOperation,
              size: source.size,
              compressedSize: expectedSize,
              ratio: ((expectedSize / source.size) * 100).toFixed(1) + '%',
              duration: performance.now() - startTime,
            },
            'File:Copy:Done',
          );
        } else {
          logger.info({ path: manifestEntry.source, size: source.size }, 'File:Copy:Skipped');
          statsUpdaters[fileOperation]({ sourceSize: source.size });
        }
        if (fileOperation === FileOperation.Skip || (targetVerified && shouldDeleteSourceOnSuccess)) {
          const startTimeDelete = performance.now();
          logger.info({ path: manifestEntry.source }, 'File:DeleteSource:Start');
          await fsa.delete(manifestEntry.source);
          statsUpdaters[FileOperation.Delete]({ sourceSize: source.size });
          logger.debug(
            { ...manifestEntry, size: source.size, duration: performance.now() - startTimeDelete },
            'File:DeleteSource:Done',
          );
        }
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
