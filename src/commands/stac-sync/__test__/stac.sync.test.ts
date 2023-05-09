import o from 'ospec';
import { FsMemory } from '@chunkd/source-memory';
import { fsa } from '@chunkd/fs';
import { synchroniseFiles } from '../stac.sync.js';

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
});
