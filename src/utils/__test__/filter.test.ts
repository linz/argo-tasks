import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import { asyncFilter } from '../chunk.js';

describe('AsyncFilter', () => {
  function makeGenerator(paths: string[]): () => AsyncGenerator<{ url: URL }> {
    return async function* gen(): AsyncGenerator<{ url: URL }> {
      for (const path of paths) yield { url: new URL(`memory://${path}`) };
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
    assert.deepEqual(
      result.map((m) => m.url.href),
      ['memory://a.tiff'],
    );
  });

  it('should match include regex', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: '^memory://a' }));
    assert.deepEqual(
      result.map((m) => m.url.href),
      ['memory://a.tiff'],
    );
  });

  it('should exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^memory://a' }));
    assert.deepEqual(
      result.map((m) => m.url.href),
      ['memory://ba.tiff', 'memory://ca.tiff'],
    );
  });

  it('should include and exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.prj', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^memory://a', include: '.tiff$' }));
    assert.deepEqual(
      result.map((m) => m.url.href),
      ['memory://ca.tiff'],
    );
  });

  it('should include exclude case insensitive', async () => {
    const gen = makeGenerator(['A.tiff', 'BA.prj', 'CA.TIFF']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^memory://a', include: '.tiff$' }));
    assert.deepEqual(
      result.map((m) => m.url.href),
      ['memory://CA.TIFF'],
    );
  });
});
