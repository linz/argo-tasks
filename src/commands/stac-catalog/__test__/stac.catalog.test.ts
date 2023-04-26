import o from 'ospec';
import { createLinks, makeRelative } from '../stac.catalog.js';
import { FsMemory } from '@chunkd/source-memory';
import { fsa } from '@chunkd/fs';

o.spec('stacCatalog', () => {
  const fs = new FsMemory();
  o.beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  o('listLocation', async () => {
    await fs.write('m://base/directory1/collection.json', JSON.stringify({ title: 'CollectionA' }));
    await fs.write('m://base/directory2/collection.json', JSON.stringify({ title: 'CollectionB' }));

    const links = await createLinks('m://base/', [
      { rel: 'self', href: './catalog.json' },
      { rel: 'root', href: './catalog.json' },
    ]);
    o(links).deepEquals([
      { rel: 'self', href: './catalog.json' },
      { rel: 'root', href: './catalog.json' },
      { rel: 'child', href: './directory1/collection.json', title: 'CollectionA' },
      { rel: 'child', href: './directory2/collection.json', title: 'CollectionB' },
    ]);
  });
});

o.spec('makeRelative', () => {
  o('should make relative urls', () => {
    o(makeRelative('s3://linz-imagery/', 's3://linz-imagery/catalog.json')).equals('catalog.json');
  });

  o('should make relative from absolute paths', () => {
    o(makeRelative('/home/blacha/', '/home/blacha/catalog.json')).equals('catalog.json');
  });

  o('should make relative relative paths', () => {
    o(makeRelative('/home/blacha/', './catalog.json')).equals('./catalog.json');
  });

  o('should not make relative on different paths', () => {
    o(() => makeRelative('/home/blacha/', '/home/test/catalog.json')).throws(Error);
  });
});
