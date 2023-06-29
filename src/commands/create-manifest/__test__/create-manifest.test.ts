import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import { describe, beforeEach, it } from 'node:test';
import assert from 'node:assert';
import { createManifest, validatePaths } from '../create-manifest.js';

describe('createManifest', () => {
  beforeEach(() => {
    memory.files.clear();
  });
  const memory = new FsMemory();
  fsa.register('memory://', memory);
  it('should copy to the target location', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true }))),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test')),
    ]);

    const outputFiles = await createManifest('memory://source/', 'memory://target/', { flatten: true });
    assert.deepEqual(outputFiles[0], [
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

  it('should transform files', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true }))),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test')),
    ]);
    const outputFiles = await createManifest('memory://source/', 'memory://target/sub/', {
      flatten: false,
      transform: 'f.replace("topographic", "test")',
    });
    assert.deepEqual(outputFiles[0], [
      {
        source: 'memory://source/topographic.json',
        target: 'memory://target/sub/test.json',
      },
      {
        source: 'memory://source/foo/bar/topographic.png',
        target: 'memory://target/sub/foo/bar/test.png',
      },
    ]);
  });

  it('should copy to the target location without flattening', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true }))),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test')),
    ]);

    const outputFiles = await createManifest('memory://source/', 'memory://target/sub/', { flatten: false });
    assert.deepEqual(outputFiles[0], [
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
  describe('validatePaths', () => {
    it('Should throw error for Missmatch Paths', () => {
      assert.throws(() => {
        validatePaths('memory://source/', 'memory://target/sub/test.tiff');
      }, Error);
    });
    it('Should also throw error for Missmatch Paths', () => {
      assert.throws(() => {
        validatePaths('memory://source/test.tiff', 'memory://target/sub/');
      }, Error);
    });
  });
});
