import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import { asyncFilter } from '../chunk.ts';

describe('AsyncFilter', () => {
  function makeGenerator(list: string[]): () => AsyncGenerator<{ url: URL }> {
    return async function* gen(): AsyncGenerator<{ url: URL }> {
      for (const path of list) yield { url: fsa.toUrl(path) };
    };
  }

  it('should include all', async () => {
    const gen = makeGenerator(['a.tiff', 'b.tiff', 'c.tiff']);
    const result = await fsa.toArray(asyncFilter(gen()));
    assert.equal(result.length, 3);
  });

  it('should match include exact', async () => {
    const gen = makeGenerator(['a.tiff', 'b.tiff', 'c.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: 'a.tiff' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('a.tiff') }]);
  });

  it('should match include regex', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: '^a' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('a.tiff') }]);
  });

  it('should exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('ba.tiff') }, { url: fsa.toUrl('ca.tiff') }]);
  });

  it('should include and exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.prj', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('ca.tiff') }]);
  });

  it('should include exclude case insensitive', async () => {
    const gen = makeGenerator(['A.tiff', 'BA.prj', 'CA.TIFF']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('CA.TIFF') }]);
  });
});
