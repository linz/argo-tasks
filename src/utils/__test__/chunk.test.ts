import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { combinePaths, getFiles, splitPaths } from '../chunk.ts';


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
