import assert from 'node:assert';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

import { hashBuffer, hashStream } from '../hash.js';

describe('hashBuffer', () => {
  it('should return the expecting digest', () => {
    const expectingDigest = '12209f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    const digest = hashBuffer(Buffer.from('test'));
    assert.equal(digest, expectingDigest);
  });
});

describe('hashStream', () => {
  it('should return the expecting digest', async () => {
    const expectingDigest = '12209f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    const stream = Readable.from(['test']);
    const digest = await hashStream(stream);
    assert.equal(digest, expectingDigest);
  });
});
