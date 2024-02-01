import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { UrlString } from '../../../utils/types.js';
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

    const outputFiles = await createManifest('memory://source/' as UrlString, 'memory://target/' as UrlString, {
      flatten: true,
    });
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
    const outputFiles = await createManifest('memory://source/' as UrlString, 'memory://target/sub/' as UrlString, {
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

    const outputFiles = await createManifest('memory://source/' as UrlString, 'memory://target/sub/' as UrlString, {
      flatten: false,
    });
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
    await Promise.all([fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })))]);

    const outputFiles = await createManifest(
      'memory://source/topographic.json' as UrlString,
      'memory://target/sub/topographic.json' as UrlString,
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
    it('Should throw error for Missmatch Paths', () => {
      assert.throws(() => {
        validatePaths('memory://source/' as UrlString, 'memory://target/sub/test.tiff' as UrlString);
      }, Error);
    });
    it('Should also throw error for Missmatch Paths', () => {
      assert.throws(() => {
        validatePaths('memory://source/test.tiff' as UrlString, 'memory://target/sub/' as UrlString);
      }, Error);
    });
  });
});
