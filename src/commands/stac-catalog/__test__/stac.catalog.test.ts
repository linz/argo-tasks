import o from 'ospec';
import { createLinks } from '../stac.catalog.js';

o.spec('stacCatalog', function () {
  o('listLocation', async function () {
    o(
      createLinks(['./directory1/collection.json', './directory2/collection.json'], 's3://example/catalog.json'),
    ).deepEquals([
      { rel: 'self', href: 's3://example/catalog.json' },
      { rel: 'root', href: 's3://example/catalog.json' },
      { rel: 'child', href: './directory1/collection.json' },
      { rel: 'child', href: './directory2/collection.json' },
    ]);
  });
});
