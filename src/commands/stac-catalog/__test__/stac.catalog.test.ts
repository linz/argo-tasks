import o from 'ospec';
import { createLinks } from '../stac.catalog.js';

o.spec('stacCatalog', function () {
  o('listLocation', async function () {
    o(
      createLinks(
        ['./directory1/collection.json', './directory2/collection.json', ''],
        [
          { rel: 'self', href: './catalog.json' },
          { rel: 'root', href: './catalog.json' },
        ],
      ),
    ).deepEquals([
      { rel: 'self', href: './catalog.json' },
      { rel: 'root', href: './catalog.json' },
      { rel: 'child', href: './directory1/collection.json' },
      { rel: 'child', href: './directory2/collection.json' },
    ]);
  });
});
