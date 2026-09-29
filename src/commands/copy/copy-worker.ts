import { performance } from 'node:perf_hooks';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parentPort, threadId } from 'node:worker_threads';
import { constants, createZstdCompress, createZstdDecompress } from 'node:zlib';

import { type FileInfo, fsa } from '@chunkd/fs';
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
interface CopyEntryContext {
  args: CopyContractArgs;
  manifestEntry: NonNullable<CopyContractArgs['manifest'][number]>;
  source: FileInfo;
  sourceLocation: URL;
  sourceSize: number;
  targetLocation: URL;
  startTime: number;
  stats: CopyStats;
}

async function copyEntryAttempt({
  args,
  manifestEntry,
  source,
  sourceLocation,
  sourceSize,
  targetLocation,
  startTime,
  stats,
}: CopyEntryContext): Promise<void> {
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
    let sourceStreamPromise: Promise<void>;

    const shouldCompress = fileOperation === FileOperation.Compress;
    const shouldDecompress = fileOperation === FileOperation.Decompress;
    const shouldFixMetadata = args.fixContentType || shouldDecompress || shouldCompress;

    switch (fileOperation) {
      case FileOperation.Copy: {
        const copySourceStream = new PassThrough();
        sourceStream = copySourceStream;
        sourceStreamPromise = pipeline(rawSourceStream, hashOriginal, copySourceStream);
        break;
      }
      case FileOperation.Compress: {
        const zstdCompress = createZstdCompress({
          params: {
            [constants.ZSTD_c_compressionLevel]: 17,
          },
        });
        const compressedSourceStream = new PassThrough();
        sourceStream = compressedSourceStream;
        sourceStreamPromise = pipeline(
          rawSourceStream,
          hashOriginal,
          zstdCompress,
          hashCompressed,
          compressedSourceStream,
        );
        break;
      }
      case FileOperation.Decompress: {
        const zstdDecompress = createZstdDecompress();
        const decompressedSourceStream = new PassThrough();
        sourceStream = decompressedSourceStream;
        sourceStreamPromise = pipeline(
          rawSourceStream,
          hashCompressed,
          zstdDecompress,
          hashOriginal,
          decompressedSourceStream,
        );
        break;
      }
      default:
        throw new Error(`Unknown file operation [${String(fileOperation)}] for source: ${manifestEntry.source}`);
    }

    const fileMetadata = shouldFixMetadata ? fixFileMetadata(target.url, source) : source;

    logger.info({ path: manifestEntry.source, size: sourceSize }, 'File:Copy:Write');
    let expectedSize: number | undefined;
    let expectedHash: string | undefined;
    try {
      await fsa.write(target.url, sourceStream, fileMetadata);
      await sourceStreamPromise;
      logger.info({ path: manifestEntry.source, size: sourceSize }, 'File:Copy:Verify');
      expectedSize = shouldDecompress ? hashOriginal.size : shouldCompress ? hashCompressed.size : sourceSize;
      expectedHash = hashOriginal.multihash;
      targetVerified = await verifyTargetFile(target.url, expectedSize, expectedHash);
      if (!targetVerified) {
        await fsa.delete(target.url);
        throw new Error(`Failed to copy source:${manifestEntry.source} target:${protocolAwareString(target.url)}`);
      }
    } catch (error) {
      if (isZstdError(error)) {
        await fsa.delete(target.url).catch(() => undefined);
      }
      throw error;
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
}

export function isZstdError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;

  const errorRecord = error as Record<string, unknown>;
  const code = typeof errorRecord['code'] === 'string' ? errorRecord['code'] : '';
  const message = typeof errorRecord['message'] === 'string' ? errorRecord['message'] : '';

  return code === 'ZSTD_error_prefix_unknown' || message.includes('Unknown frame descriptor');
}

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
          () =>
            copyEntryAttempt({
              args,
              manifestEntry,
              source,
              sourceLocation,
              sourceSize,
              targetLocation,
              startTime,
              stats,
            }),
          isZstdError,
        );
      });
    }
    await Q.join().catch((err: unknown) => {
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
