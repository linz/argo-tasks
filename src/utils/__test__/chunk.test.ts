import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { combinePaths, getFiles, splitPaths } from '../chunk.ts';

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

  it('should skip zero byte files by default', async () => {
    await fsa.write('gf://a/a.txt', Buffer.from(''));
    assert.deepEqual(await getFiles(['gf://a/']), []);
    assert.deepEqual(await getFiles(['gf://a/'], { sizeMin: 0 }), [['gf://a/a.txt']]);
  });
});

describe('combinePaths', () => {
  it('local test files should work with two relative paths', () => {
    const base = './a/b/collection.json';
    const addon = './tile.json';
    const combined = combinePaths(base, addon);
    assert.deepEqual(combined, './a/b/tile.json');
  });
  it('absolute addon paths should win', () => {
    const base = 'https://example.com/a/b/c.txt';
    const addon = '/b/c/d.txt';
    const combined = combinePaths(base, addon);
    assert.deepEqual(combined, 'https://example.com/b/c/d.txt');
  });
  it('should combine s3 paths', () => {
    const base = 's3://bucket/folder/collection.json';
    const addon = './path/to/tile.json';
    const combined = combinePaths(base, addon);
    assert.deepEqual(combined, 's3://bucket/folder/path/to/tile.json');
  });
});
