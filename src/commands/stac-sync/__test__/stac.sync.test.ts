import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { hashString } from '../../../utils/hash.js';
import { HashKey, synchroniseFiles } from '../stac.sync.js';

describe('stacSync', () => {
  const fs = new FsMemory();
  beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  it('shouldUploadFile', async () => {
    await fs.write(
      'm://source/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    await fs.write(
      'm://destination/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abc' }),
    );
    const destinationURL = new URL('m://destination/stac/');
    assert.equal(await synchroniseFiles('m://source/stac/', destinationURL), 1);
  });

  it('shouldUploadFileOnlyOnce', async () => {
    await fs.write(
      'm://source/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    await fs.write(
      'm://destination/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abc' }),
    );
    const destinationURL = new URL('m://destination/stac/');
    assert.equal(await synchroniseFiles('m://source/stac/', destinationURL), 1);
    assert.equal(await synchroniseFiles('m://source/stac/', destinationURL), 0);
  });

  it('shouldNotUploadFile', async () => {
    await fs.write(
      'm://source/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    const sourceData = await fsa.read('m://source/stac/wellington/collection.json');
    const sourceHash = hashString(sourceData);
    await fs.write(
      'm://destination/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
      { metadata: { [HashKey]: sourceHash } },
    );
    const destinationURL = new URL('m://destination/stac/');
    assert.equal(await synchroniseFiles('m://source/stac/', destinationURL), 0);
  });
});
