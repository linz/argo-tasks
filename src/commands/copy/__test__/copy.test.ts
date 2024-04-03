import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { shouldCopyFile, worker } from '../copy-worker.js';

describe('copyFiles', () => {
  const memory = new FsMemory();
  fsa.register('memory://', memory);

  beforeEach(() => {
    memory.files.clear();
  });

  it('should copy to the target location', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/json',
      }),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test'), { contentType: 'image/png' }),
    ]);

    await worker.routes.copy({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
        {
          source: 'memory://source/foo/bar/topographic.png',
          target: 'memory://target/topographic.png',
        },
      ],
      start: 0,
      size: 2,
      force: false,
      noClobber: true,
      fixContentType: true,
    });

    const [jsonSource, jsonTarget] = await Promise.all([
      fsa.head('memory://source/topographic.json'),
      fsa.head('memory://target/topographic.json'),
    ]);

    assert.equal(jsonTarget?.contentType, 'application/json');
    assert.equal(jsonSource?.contentType, 'application/json');

    const [pngSource, pngTarget] = await Promise.all([
      fsa.head('memory://source/foo/bar/topographic.png'),
      fsa.head('memory://target/topographic.png'),
    ]);

    assert.equal(pngTarget?.contentType, 'image/png');
    assert.equal(pngSource?.contentType, 'image/png');

    assert.deepEqual(
      memory.files.get('memory://source/foo/bar/topographic.png')?.buffer,
      memory.files.get('memory://target/topographic.png')?.buffer,
    );
    assert.equal(String(memory.files.get('memory://target/topographic.png')?.buffer), 'test');
  });

  it('should default to COG/json', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
      }),
      fsa.write('memory://source/foo/bar/topographic.tiff', Buffer.from('test'), {
        contentType: 'binary/octet-stream',
      }),
    ]);
    await worker.routes.copy({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
        {
          source: 'memory://source/foo/bar/topographic.tiff',
          target: 'memory://target/topographic.tiff',
        },
      ],
      start: 0,
      size: 2,
      force: false,
      noClobber: true,
      fixContentType: true,
    });
    const [jsonSource, jsonTarget] = await Promise.all([
      fsa.head('memory://source/topographic.json'),
      fsa.head('memory://target/topographic.json'),
    ]);

    assert.equal(jsonSource?.contentType, 'application/octet-stream');
    assert.equal(jsonTarget?.contentType, 'application/json');

    const [tiffSource, tiffTarget] = await Promise.all([
      fsa.head('memory://source/foo/bar/topographic.tiff'),
      fsa.head('memory://target/topographic.tiff'),
    ]);

    assert.equal(tiffSource?.contentType, 'binary/octet-stream');
    assert.equal(tiffTarget?.contentType, 'image/tiff; application=geotiff; profile=cloud-optimized');
  });

  it('should not default COG/json when fixContentType=false', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
      }),
      fsa.write('memory://source/foo/bar/topographic.tiff', Buffer.from('test'), {
        contentType: 'binary/octet-stream',
      }),
    ]);
    await worker.routes.copy({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
        {
          source: 'memory://source/foo/bar/topographic.tiff',
          target: 'memory://target/topographic.tiff',
        },
      ],
      start: 0,
      size: 2,
      force: false,
      noClobber: true,
      fixContentType: false,
    });
    const [jsonSource, jsonTarget] = await Promise.all([
      fsa.head('memory://source/topographic.json'),
      fsa.head('memory://target/topographic.json'),
    ]);

    assert.equal(jsonSource?.contentType, 'application/octet-stream');
    assert.equal(jsonTarget?.contentType, 'application/octet-stream');

    const [tiffSource, tiffTarget] = await Promise.all([
      fsa.head('memory://source/foo/bar/topographic.tiff'),
      fsa.head('memory://target/topographic.tiff'),
    ]);

    assert.equal(tiffSource?.contentType, 'binary/octet-stream');
    assert.equal(tiffTarget?.contentType, 'binary/octet-stream');
  });
});

describe('copyFileCheck', () => {
  const source = { path: 's3://source/bar.json', size: 1, eTag: 'abc123' };
  const target = { path: 's3://target/bar.json', size: 1, eTag: 'abc123' };

  it('should copy to new location', () => {
    assert.equal(shouldCopyFile({ path: 's3://foo/bar.json' }, null), true);
  });

  it('should not overwrite existing location', () => {
    assert.equal(shouldCopyFile({ path: 's3://foo/bar.json', size: 1 }, { path: 's3://foo/baz.json', size: 1 }), false);
  });

  describe('--force', () => {
    it('should overwrite existing location', () => {
      assert.equal(shouldCopyFile(source, target, { force: true }), true);
      assert.equal(shouldCopyFile(source, { ...target, size: 2 }, { force: true }), true);
      assert.equal(shouldCopyFile(source, { ...target, eTag: 'abc' }, { force: true }), true);
      assert.equal(shouldCopyFile(source, { ...target, eTag: undefined }, { force: true }), true);
    });
  });

  describe('--no-clobber', () => {
    it('should skip existing files', () => {
      assert.equal(shouldCopyFile(source, target, { noClobber: true }), 'skip');
    });

    it('should not copy if etag mismatch', () => {
      assert.equal(shouldCopyFile(source, { ...target, eTag: '321cba' }, { noClobber: true }), false);
    });

    it('should not copy if size mismatch', () => {
      assert.equal(shouldCopyFile(source, { ...target, size: 2 }, { noClobber: true }), false);
    });

    it('should not overwrite if source is missing eTag', () => {
      assert.equal(shouldCopyFile({ ...source, eTag: undefined }, { ...target }, { noClobber: true }), false);
    });
  });

  describe('--force, --no-clobber', () => {
    it('should skip existing files', () => {
      assert.equal(shouldCopyFile(source, target, { noClobber: true, force: true }), 'skip');
    });

    it('should overwrite if etag mismatch', () => {
      assert.equal(shouldCopyFile(source, { ...target, eTag: '321cba' }, { noClobber: true, force: true }), true);
    });

    it('should overwrite if size mismatch', () => {
      assert.equal(shouldCopyFile(source, { ...target, size: 2 }, { noClobber: true, force: true }), true);
    });

    it('should overwrite if source is missing eTag', () => {
      assert.equal(
        shouldCopyFile({ ...source, eTag: undefined }, { ...target }, { noClobber: true, force: true }),
        true,
      );
    });
  });
});
