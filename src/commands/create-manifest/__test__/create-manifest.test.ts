import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import o from 'ospec';
import { createManifest } from '../create-manifest.js';

o.spec('createManifest', () => {
  o.beforeEach(() => {
    memory.files.clear();
  });
  const memory = new FsMemory();
  fsa.register('memory://', memory);
  o('should copy to the target location', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true }))),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test')),
    ]);

    const outputFiles = await createManifest('memory://source/', 'memory://target/', { flatten: true });
    o(outputFiles[0]).deepEquals([
      {
        source: 'memory://source/topographic.json',
        target: 'memory://target/topographic.json',
      },
      {
        source: 'memory://source/foo/bar/topographic.png',
        target: 'memory://target/topographic.png',
      },
    ]);
  });

  o('should copy to the target location without flattening', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true }))),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test')),
    ]);

    const outputFiles = await createManifest('memory://source/', 'memory://target/sub/', { flatten: false });
    o(outputFiles[0]).deepEquals([
      {
        source: 'memory://source/topographic.json',
        target: 'memory://target/sub/topographic.json',
      },
      {
        source: 'memory://source/foo/bar/topographic.png',
        target: 'memory://target/sub/foo/bar/topographic.png',
      },
    ]);
  });
});
