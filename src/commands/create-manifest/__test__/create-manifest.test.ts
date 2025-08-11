import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/fs';

import { createManifest, validatePaths } from '../create-manifest.ts';

describe('createManifest', () => {
  beforeEach(() => {
    memory.files.clear();
  });
  const memory = new FsMemory();
  fsa.register('memory://', memory);
  it('should copy to the target location', async () => {
    await Promise.all([
      fsa.write(fsa.toUrl('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(fsa.toUrl('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
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
      fsa.write(fsa.toUrl('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(fsa.toUrl('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
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
      fsa.write(fsa.toUrl('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(fsa.toUrl('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
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

  it('should copy single file to the target location without a trailing /', async () => {
    await Promise.all([
      fsa.write(fsa.toUrl('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
    ]);

    const outputFiles = await createManifest(
      'memory://source/topographic.json',
      'memory://target/sub/topographic.json',
      { flatten: false },
    );
    assert.deepEqual(outputFiles[0], [
      {
        source: 'memory://source/topographic.json',
        target: 'memory://target/sub/topographic.json',
      },
    ]);
  });
  describe('validatePaths', () => {
    it('Should throw error for mismatched paths', () => {
      assert.throws(() => {
        validatePaths('memory://source/', 'memory://target/sub/test.tiff');
      }, Error);
    });
    it('Should also throw error for mismatched paths', () => {
      assert.throws(() => {
        validatePaths('memory://source/test.tiff', 'memory://target/sub/');
      }, Error);
    });
  });
});
