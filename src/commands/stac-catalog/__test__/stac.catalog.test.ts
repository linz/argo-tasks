import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { createLinks, makeRelative } from '../stac.catalog.js';

describe('stacCatalog', () => {
  const fs = new FsMemory();
  beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  it('listLocation', async () => {
    await fs.write(new URL('m://base/directory1/collection.json'), JSON.stringify({ title: 'CollectionA' }));
    await fs.write(new URL('m://base/directory2/collection.json'), JSON.stringify({ title: 'CollectionB' }));

    const links = await createLinks(new URL('m://base/'), [
      { rel: 'self', href: './catalog.json' },
      { rel: 'root', href: './catalog.json' },
    ]);
    assert.deepEqual(links, [
      { rel: 'self', href: './catalog.json' },
      { rel: 'root', href: './catalog.json' },
      {
        rel: 'child',
        href: './directory1/collection.json',
        title: 'CollectionA',
        'file:checksum': '1220e57ac0913bab02b8056d8553c8e48b8ca86ee99ff5b5bf610baab14a4e3e431f',
        'file:size': 23,
      },
      {
        rel: 'child',
        href: './directory2/collection.json',
        title: 'CollectionB',
        'file:checksum': '1220e757bdb6cf2ba81f006286bb71a550c3d5955bdecbce62727d119e19347700ec',
        'file:size': 23,
      },
    ]);
  });
});

describe('makeRelative', () => {
  it('should make relative urls', () => {
    assert.equal(
      makeRelative(fsa.toUrl('s3://linz-imagery/'), fsa.toUrl('s3://linz-imagery/catalog.json')),
      './catalog.json',
    );
  });

  it('should make relative from absolute paths', () => {
    assert.equal(makeRelative(fsa.toUrl('/home/blacha/'), fsa.toUrl('/home/blacha/catalog.json')), './catalog.json');
  });

  it('should not make relative on different hosts', () => {
    assert.throws(
      () => makeRelative(fsa.toUrl('https://google.com/blacha/'), fsa.toUrl('https://fake.com/test/catalog.json')),
      Error,
    );
  });

  it('should not make relative on different protocols', () => {
    assert.throws(
      () => makeRelative(fsa.toUrl('s3://fake.com/blacha/'), fsa.toUrl('file://fake.com/test/catalog.json')),
      Error,
    );
  });

  it('should not make relative on different ports', () => {
    assert.throws(
      () => makeRelative(fsa.toUrl('s3://fake.com:443/blacha/'), fsa.toUrl('s3://fake.com:883/test/catalog.json')),
      Error,
    );
  });
});
