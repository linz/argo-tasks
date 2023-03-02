import { createHash } from 'crypto';
import { Readable } from 'stream';

/**
 * Create a multihash from a stream
 *
 * @returns sha256 mulithash string of the stream
 *
 */
export async function hashStream(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    stream.on('data', (chunk) => hash.update(chunk));
    // 0x12 - ID of sha256 multi hash
    // 0x20 - 32 bytes (256 bits) of data
    stream.on('end', () => resolve(`1220` + hash.digest('hex')));
    stream.on('error', reject);
  });
}
