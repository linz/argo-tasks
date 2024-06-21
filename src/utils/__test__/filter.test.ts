import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import { asyncFilter } from '../chunk.js';

void describe('AsyncFilter', () => {
  function makeGenerator(list: string[]): () => AsyncGenerator<{ path: string }> {
    return async function* gen(): AsyncGenerator<{ path: string }> {
      for (const path of list) yield { path };
    };
  }

  void it('should include all', async () => {
    const gen = makeGenerator(['a.tiff', 'b.tiff', 'c.tiff']);
    const result = await fsa.toArray(asyncFilter(gen()));
    assert.equal(result.length, 3);
  });

  void it('should match include exact', async () => {
    const gen = makeGenerator(['a.tiff', 'b.tiff', 'c.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: 'a.tiff' }));
    assert.deepEqual(result, [{ path: 'a.tiff' }]);
  });

  void it('should match include regex', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: '^a' }));
    assert.deepEqual(result, [{ path: 'a.tiff' }]);
  });

  void it('should exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a' }));
    assert.deepEqual(result, [{ path: 'ba.tiff' }, { path: 'ca.tiff' }]);
  });

  void it('should include and exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.prj', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    assert.deepEqual(result, [{ path: 'ca.tiff' }]);
  });

  void it('should include exclude case insensitive', async () => {
    const gen = makeGenerator(['A.tiff', 'BA.prj', 'CA.TIFF']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    assert.deepEqual(result, [{ path: 'CA.TIFF' }]);
  });
});
