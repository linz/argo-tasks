import { performance } from 'node:perf_hooks';
import { parentPort, threadId } from 'node:worker_threads';

import { LogType } from '@basemaps/config/build/json/log.js';
import { FileInfo } from '@chunkd/core';
import { fsa } from '@chunkd/fs';
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

/**
 * Should a file be copied
 *
 * if the file exists the out come can be configured with
 * - `--no-clobber` - Do not overwrite files if their eTags match, this only works on locations with eTag (eg S3)
 * - `--force` - Force overwrite files if they exist in the target
 *
 * @returns
 *  - `"skip"` if the file should be skipped
 *  - `false` if the file should not be copied and a error thrown
 *  - `true` if the file should be copied
 */
export function shouldCopyFile(
  source: FileInfo,
  target: FileInfo | null,
  options?: { noClobber?: boolean; force?: boolean },
  log?: LogType,
): 'skip' | boolean {
  // Target file doesn't exist so copy it
  if (target == null) return true;

  const isForce = options?.force === true;
  const isNoClobber = options?.noClobber === true;

  // Force overwrite even if the file is the same
  if (isForce && !isNoClobber) return true;

  if (target.eTag != null) {
    // eTag are the same and file size are the same so no need to overwrite
    if (source.eTag === target.eTag && source.size === target.size) {
      if (isNoClobber) return 'skip';
    }

    if (source.eTag == null) {
      // Force overwrite even if the source etag is missing
      if (isForce) return true;

      // Writing a unknown source file into target file without --force
      // TODO should this be disallowed
      log?.warn(
        {
          source: source.path,
          sourceInfo: { ...source, path: undefined },
          target: target.path,
          targetInfo: { ...target, path: undefined }, // path is logged as source or target
        },
        'File:Copy:Etag:SourceEtagMissing',
      );

      return false;
    }
  }

  if (isForce) return true;

  // Target has no Etag, source has no Etag, --force=false, --no-clobber=true no way to determine if the files are the same
  return false;
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
        if (source == null) throw new Error(`Cannot copy source: ${todo.source} file missing`);

        const copyType = shouldCopyFile(source, target, args, log);

        if (copyType === 'skip') {
          log.info({ path: todo.target, size: target?.size, eTag: source.eTag }, 'File:Copy:Skipped');
          stats.skipped++;
          stats.skippedBytes += source.size ?? 0;
          return;
        }

        if (copyType === false) {
          throw new Error(
            `Cannot overwrite file: "${todo.target}" ${target?.eTag} source: "${todo.source}" ${source.eTag}`,
          );
        }

        log.trace(todo, 'File:Copy:start');
        const startTime = performance.now();
        await fsa.write(
          todo.target,
          fsa.stream(todo.source),
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
        log.debug(
          { ...todo, isOverwrite: target != null, size: targetSize, duration: performance.now() - startTime },
          'File:Copy',
        );

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
