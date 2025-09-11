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

  it('should respect our default filters', async () => {
    const gen = makeGenerator([
      's3://bucket/path/to/flat/AS12.tiff',
      's3://bucket/path/to/flat/AS13.tiff',
      's3://bucket/path/to/flat/AT12.tiff',
      's3://bucket/path/to/flat/AT13.tiff',
      's3://bucket/path/to/flat/AS12.json',
      's3://bucket/path/to/flat/AS13.json',
      's3://bucket/path/to/flat/AT12.json',
      's3://bucket/path/to/flat/AT13.json',
      's3://bucket/path/to/flat/AS12.tfw',
      's3://bucket/path/to/flat/AS12.prj',
      's3://bucket/path/to/flat/AS13.tfw',
      's3://bucket/path/to/flat/AT12.prj',
      's3://bucket/path/to/flat/README.txt',
      's3://bucket/path/to/flat/collection.json',
      's3://bucket/path/to/flat/capture-area.geojson',
      's3://bucket/path/to/flat/capture-dates.geojson',
      's3://bucket/path/to/flat/notcapture-dates.geojson',
    ]);
    const expectedResults = [
      's3://bucket/path/to/flat/AS12.tiff',
      's3://bucket/path/to/flat/AS13.tiff',
      's3://bucket/path/to/flat/AT12.tiff',
      's3://bucket/path/to/flat/AT13.tiff',
      's3://bucket/path/to/flat/AS12.json',
      's3://bucket/path/to/flat/AS13.json',
      's3://bucket/path/to/flat/AT12.json',
      's3://bucket/path/to/flat/AT13.json',
      's3://bucket/path/to/flat/AS12.tfw',

      's3://bucket/path/to/flat/AS13.tfw',

      's3://bucket/path/to/flat/capture-area.geojson',
      's3://bucket/path/to/flat/capture-dates.geojson',
    ].map((f) => {
      return { url: fsa.toUrl(f) };
    });

    const result = await fsa.toArray(
      asyncFilter(gen(), {
        include: '\\.tiff?$|\\.json$|\\.tfw$|/capture-area\\.geojson$|/capture-dates\\.geojson$',
        exclude: 'collection.json$',
      }),
    );
    assert.deepEqual(result, expectedResults);
  });
  it('should include all', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/a.tiff',
      'file:///path/to/file/b.tiff',
      'file:///path/to/file/c.tiff',
    ]);
    const result = await fsa.toArray(asyncFilter(gen()));
    assert.equal(result.length, 3);
  });

  it('should match include exact', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/a.tiff',
      'file:///path/to/file/b.tiff',
      'file:///path/to/file/c.tiff',
    ]);
    const result = await fsa.toArray(asyncFilter(gen(), { include: 'file:///path/to/file/a.tiff' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('file:///path/to/file/a.tiff') }]);
  });

  it('should match include partial', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/a.tiff',
      'file:///path/to/file/b.tiff',
      'file:///path/to/file/c.tiff',
    ]);
    const result = await fsa.toArray(asyncFilter(gen(), { include: 'a.tiff' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('file:///path/to/file/a.tiff') }]);
  });

  it('should match include regex', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/a.tiff',
      'file:///path/to/file/ba.tiff',
      'file:///path/to/file/ca.tiff',
    ]);
    const result = await fsa.toArray(asyncFilter(gen(), { include: '/a' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('file:///path/to/file/a.tiff') }]);
  });

  it('should exclude', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/a.tiff',
      'file:///path/to/file/ba.tiff',
      'file:///path/to/file/ca.tiff',
    ]);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '/a' }));
    assert.deepEqual(result, [
      { url: fsa.toUrl('file:///path/to/file/ba.tiff') },
      { url: fsa.toUrl('file:///path/to/file/ca.tiff') },
    ]);
  });

  it('should include and exclude', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/a.tiff',
      'file:///path/to/file/ba.prj',
      'file:///path/to/file/ca.tiff',
    ]);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '/a', include: '.tiff$' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('file:///path/to/file/ca.tiff') }]);
  });

  it('should include exclude case insensitive', async () => {
    const gen = makeGenerator([
      'file:///path/to/file/A.tiff',
      'file:///path/to/file/BA.prj',
      'file:///path/to/file/CA.TIFF',
    ]);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '/a', include: '.tiff$' }));
    assert.deepEqual(result, [{ url: fsa.toUrl('file:///path/to/file/CA.TIFF') }]);
  });
});
