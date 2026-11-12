import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { UrlList } from '../../commands/common.ts';
import { chunkItems, getFiles } from '../chunk.ts';

describe('chunkItems', () => {
  it('should chunk by count', () => {
    assert.deepEqual(chunkItems([1, 2, 3, 4], 2), [
      [1, 2],
      [3, 4],
    ]);
    assert.deepEqual(chunkItems([1, 2, 3, 4], 3), [[1, 2, 3], [4]]);
    assert.deepEqual(chunkItems([1, 2, 3, 4], 100), [[1, 2, 3, 4]]);
    assert.deepEqual(chunkItems([1, 2, 3, 4], 1), [[1], [2], [3], [4]]);
  });

  it('should have no count limit at 0', () => {
    assert.deepEqual(chunkItems([1, 2, 3, 4], 0), [[1, 2, 3, 4]]);
  });

  it('should chunk by size, overshooting by one item', () => {
    assert.deepEqual(
      chunkItems([4, 20, 4, 4, 4], 0, 10, (v) => v),
      [
        [4, 20],
        [4, 4, 4],
      ],
    );
  });

  it('should chunk by whichever limit is reached first', () => {
    assert.deepEqual(
      chunkItems([4, 4, 4, 20], 2, 10, (v) => v),
      [
        [4, 4],
        [4, 20],
      ],
    );
  });
});

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
    assert.deepEqual(files, [[fsa.toUrl('gf://a/a.txt'), fsa.toUrl('gf://b/b.txt'), fsa.toUrl('gf://c/c.txt')]]);
  });

  it('should skip zero byte files by default', async () => {
    await fsa.write(fsa.toUrl('gf://a/a.txt'), Buffer.from(''));
    assert.deepEqual(await getFiles(await UrlList.from(['gf://a/'])), []);
    assert.deepEqual(await getFiles(await UrlList.from(['gf://a/']), { sizeMin: 0 }), [[fsa.toUrl('gf://a/a.txt')]]);
  });
});
