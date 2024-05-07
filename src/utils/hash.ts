import { createHash } from 'crypto';
import { Readable } from 'stream';

/** 1220 is the starting prefix for all sha256 multihashes
 *  0x12 - ID of sha256 multi hash
 *  0x20 - 32 bytes (256 bits) of data
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
 * Create a multihash from a string or Buffer
 *
 * @param x a string or `Buffer`
 * @returns sha256 multihash string of the string or `Buffer`
 */
export function hashString(x: Buffer | string): string {
  return Sha256Prefix + createHash('sha256').update(x).digest('hex');
}
