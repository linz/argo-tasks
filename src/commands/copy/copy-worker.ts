import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';
import { createZstdCompress } from 'node:zlib';

import type { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';

import { logger } from '../../log.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { HashTransform } from '../../utils/hash.stream.ts';
import { HashKey, hashStream } from '../../utils/hash.ts';
import { registerCli } from '../common.ts';
import { isTiff } from '../tileindex-validate/tileindex.validate.ts';
import type { CopyContract, CopyContractArgs, CopyStats } from './copy-rpc.ts';

const Q = new ConcurrentQueue(10);

export const MinSizeForCompression = 500; // testing with random ASCII data shows that compression is not worth it below this size
export const FixableContentType = new Set(['binary/octet-stream', 'application/octet-stream']);

/**
 * Sets contentEncoding metadata for compressed files.
 * Also, if the file has been written with a unknown binary contentType attempt to fix it with common content types
 *
 *
 * @param path File path to fix the metadata of
 * @param meta File metadata
 * @returns New fixed file metadata if fixed otherwise source file metadata
 */
export function fixFileMetadata(path: string, meta: FileInfo): FileInfo {
  if (path.toLowerCase().endsWith('.zst')) {
    return { ...meta, contentType: 'application/zstd' };
  }

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
 * @returns file size if it exists or null
 */
async function tryHead(filePath: string, retryCount = 3): Promise<FileInfo | null> {
  for (let i = 0; i < retryCount; i++) {
    const ret = await fsa.head(filePath);
    if (ret?.size) return ret;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

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
    const end = Math.min(args.start + args.size, args.manifest.length);

    if (currentId == null) {
      logger.setBindings({ correlationId: args.id, threadId });
      currentId = args.id;
    }

    for (let i = args.start; i < end; i++) {
      const manifestEntry = args.manifest[i];
      if (manifestEntry == null) continue;

      Q.push(async () => {
        const source = await fsa.head(manifestEntry.source);

        if (source == null) return;
        if (source.size == null) return;
        if (source.metadata == null) {
          source.metadata = {};
        }
        const shouldCompress = args.compress && source.size > MinSizeForCompression;
        const targetName = manifestEntry.target + (shouldCompress ? '.zst' : '');
        const target = await fsa.head(targetName);

        if (source.metadata[HashKey] == null) {
          logger.trace({ path: manifestEntry.source, size: source.size }, 'File:Copy:HashingSource');
          const startTime = performance.now();
          source.metadata[HashKey] = await hashStream(fsa.stream(manifestEntry.source));
          logger.info(
            {
              path: manifestEntry.source,
              size: source.size,
              multihash: source.metadata[HashKey],
              duration: performance.now() - startTime,
            },
            'File:Copy:HashingSource',
          );
        }
        if (target != null) {
          // if the target file does not have a `multihash` stored as metadata, the system won't hash the file (as it's done for the source) to verify it against the source `multihash` to make sure the copy is not skipped. This is intentional in order to actually copy the file to be able to store the `multihash` in the AWS s3 metadata.
          if (
            args.noClobber &&
            (shouldCompress || source?.size === target.size) &&
            source.metadata[HashKey] === target.metadata?.[HashKey] &&
            target.metadata?.[HashKey] != null
          ) {
            logger.info({ path: targetName, size: target.size }, 'File:Copy:Skipped');
            stats.skipped++;
            stats.skippedBytes += source.size;
            if (args.deleteSource) {
              const startTimeDelete = performance.now();
              logger.info({ path: manifestEntry.source }, 'File:DeleteSource');
              await fsa.delete(manifestEntry.source);
              stats.deleted++;
              stats.deletedBytes += source.size;
              logger.debug(
                { ...manifestEntry, size: source.size, duration: performance.now() - startTimeDelete },
                'File:DeleteSource:Done',
              );
            }
            return;
          }
          // if the target file already exists and the user did not specify --force, raise an error
          if (!args.force) {
            logger.error({ target: target.path, source: source.path }, 'File:Overwrite');
            throw new Error(
              'Target already exists with different hash. Use --force to overwrite. target: ' +
                targetName +
                ' source: ' +
                manifestEntry.source,
            );
          }
        }
        // we got through all the checks, so we can copy the file and compress it if needed
        const hashOriginal = new HashTransform('sha256');
        const hashCompressed = new HashTransform('sha256');

        const startTime = performance.now();

        const rawSourceStream = fsa.stream(manifestEntry.source);
        let sourceStream = rawSourceStream;
        if (shouldCompress) {
          logger.trace(manifestEntry, 'File:Compress:start');
          const zstd = createZstdCompress();
          sourceStream = rawSourceStream.pipe(hashOriginal).pipe(zstd).pipe(hashCompressed);
        } else {
          logger.trace(manifestEntry, 'File:Copy:start');
          sourceStream = rawSourceStream.pipe(hashOriginal);
        }

        await fsa.write(
          targetName,
          sourceStream,
          args.fixContentType || shouldCompress ? fixFileMetadata(targetName, source) : source,
        );

        const targetReadBack = await tryHead(targetName);
        const targetSize = targetReadBack?.size;
        const targetHash = targetReadBack?.metadata?.[HashKey];

        const expectedSize = shouldCompress ? hashCompressed.size : source.size;
        if (targetSize !== expectedSize || targetHash !== source.metadata[HashKey]) {
          logger.fatal(
            { ...manifestEntry, sourceHash: source.metadata[HashKey], targetHash: targetHash },
            'Copy:Failed',
          );
          // Cleanup the failed copy so it can be retried
          if (targetSize != null) await fsa.delete(targetName);
          throw new Error(`Failed to copy source:${manifestEntry.source} target:${targetName}`);
        }
        logger.debug({ ...manifestEntry, size: targetSize, duration: performance.now() - startTime }, 'File:Copy');

        if (shouldCompress) {
          stats.compressed++;
          stats.compressedInputBytes += source.size;
          stats.compressedOutputBytes += expectedSize;
          logger.debug(
            {
              ...manifestEntry,
              size: source.size,
              compressedSize: expectedSize,
              ratio: ((expectedSize / source.size) * 100).toFixed(1) + '%',
              duration: performance.now() - startTime,
            },
            'File:Compress:Done',
          );
        } else {
          stats.copied++;
          stats.copiedBytes += source.size;
          logger.debug(
            { ...manifestEntry, size: source.size, duration: performance.now() - startTime },
            'File:Copy:Done',
          );
        }
        if (args.deleteSource) {
          const startTimeDelete = performance.now();
          logger.info({ path: manifestEntry.source }, 'File:DeleteSource');
          await fsa.delete(manifestEntry.source);
          stats.deleted++;
          stats.deletedBytes += source.size;
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
    stats.copied += stats.compressed;
    stats.copiedBytes += stats.compressedOutputBytes;
    return stats;
  },
});

worker.onStart = (): Promise<void> => {
  registerCli({ name: 'copy:worker' }, {});
  return Promise.resolve();
};

if (parentPort) worker.bind(parentPort);
