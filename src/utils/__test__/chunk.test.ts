import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { getFiles, splitPaths } from '../chunk.js';

describe('splitPaths', () => {
  it('should split on ;', () => {
    assert.deepEqual(splitPaths(['a;b']), ['a', 'b']);
  });
  it('should split on \\n', () => {
    assert.deepEqual(splitPaths(['a\nb']), ['a', 'b']);
  });
  it('should split combined', () => {
    assert.deepEqual(splitPaths(['a\nb;c']), ['a', 'b', 'c']);
  });
});

describe('getFiles', () => {
  const mem = new FsMemory();
  beforeEach(() => {
    fsa.register('gf://', mem);
    mem.files.clear();
  });

  it('should list files with split paths', async () => {
    await fsa.write('gf://a/a.txt', Buffer.from('hello world'));
    await fsa.write('gf://b/b.txt', Buffer.from('hello world'));
    await fsa.write('gf://c/c.txt', Buffer.from('hello world'));

    const files = await getFiles(['gf://a/;gf://b/\ngf://c/']);
    assert.deepEqual(files, [['gf://a/a.txt', 'gf://b/b.txt', 'gf://c/c.txt']]);
  });
});
