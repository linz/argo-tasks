import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';

import { asyncFilter } from '../chunk.ts';
import { RelativeDate } from '../date.ts';

describe('AsyncFilter', () => {
  function makeGenerator(list: string[]): () => AsyncGenerator<{ path: string }> {
    return async function* gen(): AsyncGenerator<{ path: string }> {
      for (const path of list) yield { path };
    };
  }

  /**
   * Generate a list of files with last modified dates starting at 1 hour ago then increasing by one hour
   * for every item in the list
   *
   * @example
   * makeGeneratorWithDates(['a', 'b', 'c'])
   * // a 1 hour ago
   * // b 2 hours ago
   * // c 3 hourss ago
   *
   * @param list
   * @returns
   */
  function makeGeneratorWithDates(list: string[]): () => AsyncGenerator<{ path: string; lastModified?: string }> {
    const startTime = new Date().getTime();
    let index = 1;
    return async function* gen(): AsyncGenerator<{ path: string; lastModified: string }> {
      for (const path of list)
        yield { path, lastModified: new Date(startTime - 60 * 60 * 1000 * index++).toISOString() };
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
    assert.deepEqual(result, [{ path: 'a.tiff' }]);
  });

  it('should match include regex', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: '^a' }));
    assert.deepEqual(result, [{ path: 'a.tiff' }]);
  });

  it('should exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a' }));
    assert.deepEqual(result, [{ path: 'ba.tiff' }, { path: 'ca.tiff' }]);
  });

  it('should include and exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.prj', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    assert.deepEqual(result, [{ path: 'ca.tiff' }]);
  });

  it('should include exclude case insensitive', async () => {
    const gen = makeGenerator(['A.tiff', 'BA.prj', 'CA.TIFF']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    assert.deepEqual(result, [{ path: 'CA.TIFF' }]);
  });

  const filterDates = async (
    opt: { since?: string; until?: string },
    files = ['A.tiff', 'B.tiff', 'C.tiff'],
  ): Promise<string[]> => {
    const gen = makeGeneratorWithDates(files);
    return fsa
      .toArray(
        asyncFilter(gen(), {
          since: opt.since ? await RelativeDate.from(opt.since) : undefined,
          until: opt.until ? await RelativeDate.from(opt.until) : undefined,
        }),
      )
      .then((m) => m.map((f) => f.path));
  };

  it('should include since', async () => {
    assert.deepEqual(await filterDates({ since: '1m' }), []);
    assert.deepEqual(await filterDates({ since: '61m' }), ['A.tiff']);
    assert.deepEqual(await filterDates({ since: '121m' }), ['A.tiff', 'B.tiff']);
    assert.deepEqual(await filterDates({ since: '181m' }), ['A.tiff', 'B.tiff', 'C.tiff']);
  });

  it('should exclude until', async () => {
    assert.deepEqual(await filterDates({ until: '1m' }), ['A.tiff', 'B.tiff', 'C.tiff']);
    assert.deepEqual(await filterDates({ until: '61m' }), ['B.tiff', 'C.tiff']);
    assert.deepEqual(await filterDates({ until: '121m' }), ['C.tiff']);
    assert.deepEqual(await filterDates({ until: '181m' }), []);
  });
  it('should include and exclude', async () => {
    assert.deepEqual(await filterDates({ until: '1m', since: '61m' }), ['A.tiff']);
    assert.deepEqual(await filterDates({ until: '61m', since: '121m' }), ['B.tiff']);
    assert.deepEqual(await filterDates({ until: '61m', since: '181m' }), ['B.tiff', 'C.tiff']);
  });
});
