import o from 'ospec';
import { FsMemory } from '@chunkd/source-memory';
import { fsa } from '@chunkd/fs';
import { HashKey, synchroniseFiles } from '../stac.sync.js';
import { createHash } from 'crypto';

o.spec('stacSync', () => {
  const fs = new FsMemory();
  o.beforeEach(() => {
    fs.files.clear();
    fsa.register('m://', fs);
  });

  o('shouldUploadFile', async () => {
    await fs.write(
      'm://source/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    await fs.write(
      'm://destination/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abc' }),
    );
    const destinationURL = new URL('m://destination/stac/');
    o(await synchroniseFiles('m://source/stac/', destinationURL)).equals(1);
  });

  o('shouldNotUploadFile', async () => {
    await fs.write(
      'm://source/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
    );
    const sourceData = await fsa.read('m://source/stac/wellington/collection.json');
    const sourceHash = '1220' + createHash('sha256').update(sourceData).digest('hex');
    await fs.write(
      'm://destination/stac/wellington/collection.json',
      JSON.stringify({ title: 'Wellington Collection', description: 'abcd' }),
      { metadata: { [HashKey]: sourceHash } },
    );
    const destinationURL = new URL('m://destination/stac/');
    o(await synchroniseFiles('m://source/stac/', destinationURL)).equals(0);
  });
});
