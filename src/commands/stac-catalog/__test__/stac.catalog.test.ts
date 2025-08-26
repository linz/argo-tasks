import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';
import { pathToFileURL } from 'url';

import { createLinks } from '../stac.catalog.ts';
import { makeRelative } from '../../../utils/filelist.ts';

describe('stacCatalog', () => {
  const fs = new FsMemory();
  beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  it('listLocation', async () => {
    await fsa.write(fsa.toUrl('m://base/directory1/collection.json'), JSON.stringify({ title: 'CollectionA' }));
    await fsa.write(fsa.toUrl('m://base/directory2/collection.json'), JSON.stringify({ title: 'CollectionB' }));

    const links = await createLinks(fsa.toUrl('m://base/'), [
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
      makeRelative(new URL('s3://linz-imagery/'), new URL('s3://linz-imagery/catalog.json')),
      './catalog.json',
    );
  });

  it('should make relative from absolute paths', () => {
    assert.equal(
      makeRelative(pathToFileURL('/home/blacha/'), pathToFileURL('/home/blacha/catalog.json')),
      './catalog.json',
    );
  });

  it('should make relative relative paths', () => {
    assert.equal(makeRelative(pathToFileURL(process.cwd() + '/'), pathToFileURL('./catalog.json')), './catalog.json');
  });

  it('should not make relative on different paths', () => {
    assert.throws(() => makeRelative(pathToFileURL('/home/blacha/'), pathToFileURL('/home/test/catalog.json')), Error);
  });
});
