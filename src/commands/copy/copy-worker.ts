import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';
import { createZstdCompress, createZstdDecompress } from 'node:zlib';

import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';

import { logger } from '../../log.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import { HashTransform } from '../../utils/hash.stream.ts';
import { registerCli } from '../common.ts';
import { determineTargetFileOperation, fixFileMetadata, statsUpdaters, verifyTargetFile } from './copy-helpers.ts';
import type { CopyContract, CopyContractArgs, CopyContractForRpc, CopyStats } from './copy-rpc.ts';
import { FileOperation } from './copy-rpc.ts';

const Q = new ConcurrentQueue(10);

/** Current log id */
let currentId: string | null = null;

const workerImplementation: CopyContract = {
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
        const { target, fileOperation, shouldDeleteSourceOnSuccess } = await determineTargetFileOperation(
          source,
          targetLocation,
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
              const zstdCompress = createZstdCompress();
              sourceStream = rawSourceStream.pipe(hashOriginal).pipe(zstdCompress).pipe(hashCompressed);
              break;
            case FileOperation.Decompress:
              const zstdDecompress = createZstdDecompress();
              sourceStream = rawSourceStream.pipe(hashCompressed).pipe(zstdDecompress).pipe(hashOriginal);
              break;
            default:
              throw new Error(`Unknown file operation [${String(fileOperation)}] for source: ${manifestEntry.source}`);
          }

          const fileMetadata = shouldFixMetadata ? fixFileMetadata(target.url, source) : source;

          logger.info({ path: manifestEntry.source, size: source.size }, 'File:Copy:Write');
          await fsa.write(target.url, sourceStream, fileMetadata);
          logger.info({ path: manifestEntry.source, size: source.size }, 'File:Copy:Verify');
          const expectedSize = shouldDecompress
            ? hashOriginal.size
            : shouldCompress
              ? hashCompressed.size
              : source.size;
          const expectedHash = hashOriginal.multihash;
          targetVerified = await verifyTargetFile(target.url, expectedSize, expectedHash);
          if (!targetVerified) {
            // Cleanup the failed copy so it can be retried
            await fsa.delete(target.url);
            throw new Error(`Failed to copy source:${manifestEntry.source} target:${protocolAwareString(target.url)}`);
          }

          statsUpdaters[fileOperation](stats, source.size, expectedSize);
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
          statsUpdaters[fileOperation](stats, source.size);
        }
        if (shouldDeleteSourceOnSuccess && (targetVerified || fileOperation === FileOperation.Skip)) {
          const startTimeDelete = performance.now();
          logger.info({ path: manifestEntry.source }, 'File:DeleteSource:Start');
          await fsa.delete(sourceLocation);
          statsUpdaters[FileOperation.Delete](stats, source.size);
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
};

export const worker = new WorkerRpc<CopyContractForRpc>(workerImplementation as CopyContractForRpc);

worker.onStart = (): Promise<void> => {
  registerCli({ name: 'copy:worker' }, {});
  return Promise.resolve();
};

if (parentPort) worker.bind(parentPort);
