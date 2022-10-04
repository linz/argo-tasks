import { fsa } from '@chunkd/fs';
import o from 'ospec';
import { asyncFilter } from '../chunk.js';

o.spec('AsyncFilter', () => {
  function makeGenerator(list: string[]): () => AsyncGenerator<{ path: string }> {
    return async function* gen(): AsyncGenerator<{ path: string }> {
      for (const path of list) yield { path };
    };
  }

  o('should include all', async () => {
    const gen = makeGenerator(['a.tiff', 'b.tiff', 'c.tiff']);
    const result = await fsa.toArray(asyncFilter(gen()));
    o(result.length).equals(3);
  });

  o('should match include exact', async () => {
    const gen = makeGenerator(['a.tiff', 'b.tiff', 'c.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: 'a.tiff' }));
    o(result).deepEquals([{ path: 'a.tiff' }]);
  });

  o('should match include regex', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { include: '^a' }));
    o(result).deepEquals([{ path: 'a.tiff' }]);
  });

  o('should exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.tiff', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a' }));
    o(result).deepEquals([{ path: 'ba.tiff' }, { path: 'ca.tiff' }]);
  });

  o('should include and exclude', async () => {
    const gen = makeGenerator(['a.tiff', 'ba.prj', 'ca.tiff']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    o(result).deepEquals([{ path: 'ca.tiff' }]);
  });

  o('should include exclude case insensitive', async () => {
    const gen = makeGenerator(['A.tiff', 'BA.prj', 'CA.TIFF']);
    const result = await fsa.toArray(asyncFilter(gen(), { exclude: '^a', include: '.tiff$' }));
    o(result).deepEquals([{ path: 'CA.TIFF' }]);
  });
});
