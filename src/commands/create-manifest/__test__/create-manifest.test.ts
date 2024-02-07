import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/fs';

import { createManifest, validatePaths } from '../create-manifest.js';

describe('createManifest', () => {
  beforeEach(() => {
    memory.files.clear();
  });
  const memory = new FsMemory();
  fsa.register('memory://', memory);
  it('should copy to the target location', async () => {
    await Promise.all([
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(new URL('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
    ]);

    const outputFiles = await createManifest(new URL('memory://source/'), new URL('memory://target/'), {
      flatten: true,
    });
    assert.deepEqual(outputFiles[0], [
      {
        source: new URL('memory://source/topographic.json'),
        target: new URL('memory://target/topographic.json'),
      },
      {
        source: new URL('memory://source/foo/bar/topographic.png'),
        target: new URL('memory://target/topographic.png'),
      },
    ]);
  });

  it('should transform files', async () => {
    await Promise.all([
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(new URL('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
    ]);
    const outputFiles = await createManifest(new URL('memory://source/'), new URL('memory://target/sub/'), {
      flatten: false,
      transform: 'f.replace("topographic", "test")',
    });
    assert.deepEqual(outputFiles[0], [
      {
        source: new URL('memory://source/topographic.json'),
        target: new URL('memory://target/sub/test.json'),
      },
      {
        source: new URL('memory://source/foo/bar/topographic.png'),
        target: new URL('memory://target/sub/foo/bar/test.png'),
      },
    ]);
  });

  it('should copy to the target location without flattening', async () => {
    await Promise.all([
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(new URL('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
    ]);

    const outputFiles = await createManifest(new URL('memory://source/'), new URL('memory://target/sub/'), {
      flatten: false,
    });
    assert.deepEqual(outputFiles[0], [
      {
        source: new URL('memory://source/topographic.json'),
        target: new URL('memory://target/sub/topographic.json'),
      },
      {
        source: new URL('memory://source/foo/bar/topographic.png'),
        target: new URL('memory://target/sub/foo/bar/topographic.png'),
      },
    ]);
  });

  it('should copy single file to the target location without a trailing /', async () => {
    await Promise.all([
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
    ]);

    const outputFiles = await createManifest(
      new URL('memory://source/topographic.json'),
      new URL('memory://target/sub/topographic.json'),
      { flatten: false },
    );
    assert.deepEqual(outputFiles[0], [
      {
        source: new URL('memory://source/topographic.json'),
        target: new URL('memory://target/sub/topographic.json'),
      },
    ]);
  });
  describe('validatePaths', () => {
    it('Should throw error for Missmatch Paths', () => {
      assert.throws(() => {
        validatePaths(new URL('memory://source/'), new URL('memory://target/sub/test.tiff'));
      }, Error);
    });
    it('Should also throw error for Missmatch Paths', () => {
      assert.throws(() => {
        validatePaths(new URL('memory://source/test.tiff'), new URL('memory://target/sub/'));
      }, Error);
    });
  });
});
