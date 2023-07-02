import { describe, beforeEach, it } from 'node:test';
import assert from 'node:assert';
import { createLinks, makeRelative } from '../stac.catalog.js';
import { FsMemory } from '@chunkd/source-memory';
import { fsa } from '@chunkd/fs';

describe('stacCatalog', () => {
  const fs = new FsMemory();
  beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  it('listLocation', async () => {
    await fs.write('m://base/directory1/collection.json', JSON.stringify({ title: 'CollectionA' }));
    await fs.write('m://base/directory2/collection.json', JSON.stringify({ title: 'CollectionB' }));

    const links = await createLinks('m://base/', [
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
    assert.equal(makeRelative('s3://linz-imagery/', 's3://linz-imagery/catalog.json'), 'catalog.json');
  });

  it('should make relative from absolute paths', () => {
    assert.equal(makeRelative('/home/blacha/', '/home/blacha/catalog.json'), 'catalog.json');
  });

  it('should make relative relative paths', () => {
    assert.equal(makeRelative('/home/blacha/', './catalog.json'), './catalog.json');
  });

  it('should not make relative on different paths', () => {
    assert.throws(() => makeRelative('/home/blacha/', '/home/test/catalog.json'), Error);
  });
});
