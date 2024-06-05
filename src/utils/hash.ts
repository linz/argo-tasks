import { createHash } from 'crypto';
import { Readable } from 'stream';

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
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(Sha256Prefix + hash.digest('hex')));
    stream.on('error', reject);
  });
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
