import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { worker } from '../copy-worker.js';

describe('copyFiles', () => {
  const memory = new FsMemory();
  fsa.register('memory://', memory);

  beforeEach(() => {
    memory.files.clear();
  });

  it('should copy to the target location', async () => {
    await Promise.all([
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/json',
      }),
      fsa.write(new URL('memory://source/foo/bar/topographic.png'), Buffer.from('test'), { contentType: 'image/png' }),
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
      fsa.head(new URL('memory://source/topographic.json')),
      fsa.head(new URL('memory://target/topographic.json')),
    ]);

    assert.equal(jsonTarget?.contentType, 'application/json');
    assert.equal(jsonSource?.contentType, 'application/json');

    const [pngSource, pngTarget] = await Promise.all([
      fsa.head(new URL('memory://source/foo/bar/topographic.png')),
      fsa.head(new URL('memory://target/topographic.png')),
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
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
      }),
      fsa.write(new URL('memory://source/foo/bar/topographic.tiff'), Buffer.from('test'), {
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
      fsa.head(new URL('memory://source/topographic.json')),
      fsa.head(new URL('memory://target/topographic.json')),
    ]);

    assert.equal(jsonSource?.contentType, 'application/octet-stream');
    assert.equal(jsonTarget?.contentType, 'application/json');

    const [tiffSource, tiffTarget] = await Promise.all([
      fsa.head(new URL('memory://source/foo/bar/topographic.tiff')),
      fsa.head(new URL('memory://target/topographic.tiff')),
    ]);

    assert.equal(tiffSource?.contentType, 'binary/octet-stream');
    assert.equal(tiffTarget?.contentType, 'image/tiff; application=geotiff; profile=cloud-optimized');
  });

  it('should not default COG/json when fixContentType=false', async () => {
    await Promise.all([
      fsa.write(new URL('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
      }),
      fsa.write(new URL('memory://source/foo/bar/topographic.tiff'), Buffer.from('test'), {
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
      fsa.head(new URL('memory://source/topographic.json')),
      fsa.head(new URL('memory://target/topographic.json')),
    ]);

    assert.equal(jsonSource?.contentType, 'application/octet-stream');
    assert.equal(jsonTarget?.contentType, 'application/octet-stream');

    const [tiffSource, tiffTarget] = await Promise.all([
      fsa.head(new URL('memory://source/foo/bar/topographic.tiff')),
      fsa.head(new URL('memory://target/topographic.tiff')),
    ]);

    assert.equal(tiffSource?.contentType, 'binary/octet-stream');
    assert.equal(tiffTarget?.contentType, 'binary/octet-stream');
  });
});
