import { createHash } from 'crypto';
import { Readable } from 'stream';

import { Sha256Prefix } from '../common.js';

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
    // 0x12 - ID of sha256 multi hash
    // 0x20 - 32 bytes (256 bits) of data
    stream.on('end', () => resolve(Sha256Prefix + hash.digest('hex')));
    stream.on('error', reject);
  });
}
