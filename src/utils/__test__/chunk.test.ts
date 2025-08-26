import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { UrlList } from '../../commands/common.ts';
import { getFiles } from '../chunk.ts';

describe('getFiles', () => {
  const mem = new FsMemory();
  beforeEach(() => {
    fsa.register('gf://', mem);
    mem.files.clear();
  });

  it('should list files with split paths', async () => {
    await fsa.write(fsa.toUrl('gf://a/a.txt'), Buffer.from('hello world'));
    await fsa.write(fsa.toUrl('gf://b/b.txt'), Buffer.from('hello world'));
    await fsa.write(fsa.toUrl('gf://c/c.txt'), Buffer.from('hello world'));

    const files = await getFiles(await UrlList.from('gf://a/;gf://b/\ngf://c/'));
    assert.deepEqual(files, [[new URL('gf://a/a.txt'), new URL('gf://b/b.txt'), new URL('gf://c/c.txt')]]);
  });

  it('should skip zero byte files by default', async () => {
    await fsa.write(fsa.toUrl('gf://a/a.txt'), Buffer.from(''));
    assert.deepEqual(await getFiles(await UrlList.from(['gf://a/'])), []);
    assert.deepEqual(await getFiles(await UrlList.from(['gf://a/']), { sizeMin: 0 }), [[new URL('gf://a/a.txt')]]);
  });
});
