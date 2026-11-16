import { fsa } from '@chunkd/fs';
import type { BinaryLike } from 'crypto';
import { createHash } from 'crypto';
import type { Readable } from 'stream';

import { protocolAwareString } from './filelist.ts';
import { isTransientNetworkError, retryOnError } from './retry.ts';

/** Key concatenated to 'x-amz-meta-' */
export const HashKey = 'multihash';

/** 1220 is the starting prefix for all sha256 multihashes
 *  - 0x12 - ID of sha256 multi hash
 *  - 0x20 - 32 bytes (256 bits) of data
 *
 *  https://multiformats.io/multihash/
 */
export const Sha256Prefix = '1220';

/**
 * Create a multihash from a stream
 *
 * @returns sha256 multihash string of the stream
 *
 */
export async function hashStream(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    stream.on('data', (chunk: BinaryLike) => hash.update(chunk));
    stream.on('end', () => resolve(Sha256Prefix + hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Retry settings for reading a file to hash */
export const HashRetry = { attempts: 3, delayMs: 1000 };

/**
 * Create a multihash from a file, retrying the read if it fails with a transient network error
 *
 * @param loc location of the file to hash
 * @returns sha256 multihash string of the file
 */
export async function hashFile(loc: URL): Promise<string> {
  return retryOnError(
    HashRetry.attempts,
    (attempt) => HashRetry.delayMs * attempt,
    () => hashStream(fsa.readStream(loc)),
    isTransientNetworkError,
    { source: protocolAwareString(loc) },
  );
}

/**
 * Create a multihash from a `Buffer`
 *
 * @param data a `Buffer`
 * @returns sha256 multihash string of a `Buffer`
 */
export function hashBuffer(data: Buffer): string {
  return Sha256Prefix + createHash('sha256').update(data).digest('hex');
}
