import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { hashBuffer, HashKey } from '../../../utils/hash.ts';
import { synchroniseFiles } from '../stac.sync.ts';

describe('stacSync', () => {
  const fs = new FsMemory();
  beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  it('shouldUploadFile', async () => {
    await fs.write(
      fsa.toUrl('m://source/stac/wellington/collection.json'),
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    await fs.write(
      fsa.toUrl('m://destination/stac/wellington/collection.json'),
      JSON.stringify({ title: 'Wellington Collection', description: 'abc' }),
    );
    const destination = fsa.toUrl('m://destination/stac/');
    assert.equal(await synchroniseFiles(fsa.toUrl('m://source/stac/'), destination), 1);
  });

  it('shouldUploadFileOnlyOnce', async () => {
    await fs.write(
      fsa.toUrl('m://source/stac/wellington/collection.json'),
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    await fs.write(
      fsa.toUrl('m://destination/stac/wellington/collection.json'),
      JSON.stringify({ title: 'Wellington Collection', description: 'abc' }),
    );
    const destination = fsa.toUrl('m://destination/stac/');
    assert.equal(await synchroniseFiles(fsa.toUrl('m://source/stac/'), destination), 1);
    assert.equal(await synchroniseFiles(fsa.toUrl('m://source/stac/'), destination), 0);
  });

  it('shouldNotUploadFile', async () => {
    await fs.write(
      fsa.toUrl('m://source/stac/wellington/collection.json'),
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    const sourceData = await fsa.read(fsa.toUrl('m://source/stac/wellington/collection.json'));
    const sourceHash = hashBuffer(sourceData);
    await fs.write(
      fsa.toUrl('m://destination/stac/wellington/collection.json'),
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
      { metadata: { [HashKey]: sourceHash } },
    );
    const destination = fsa.toUrl('m://destination/stac/');
    assert.equal(await synchroniseFiles(fsa.toUrl('m://source/stac/'), destination), 0);
  });
});
