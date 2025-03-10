import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { worker } from '../copy-worker.ts';

describe('copyFiles', () => {
  const memory = new FsMemory();
  fsa.register('memory://', memory);
  const fakeMultihash = '1220ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

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

  it('should not copy files when different size or multihash but no force', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: 'abc' })), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
          unique: 'fileA',
        },
      }),
      fsa.write('memory://target/topographic.json', Buffer.from(JSON.stringify({ test: 'abcd' })), {
        contentType: 'application/octet-stream',
        metadata: { multihash: fakeMultihash, unique: 'fileB' },
      }),
    ]);
    assert.rejects(
      worker.routes.copy({
        id: '1',
        manifest: [
          {
            source: 'memory://source/topographic.json',
            target: 'memory://target/topographic.json',
          },
        ],
        start: 0,
        size: 1,
        force: false,
        noClobber: true,
        fixContentType: false,
      }),
      new Error('Cannot overwrite file: memory://target/topographic.json source: memory://source/topographic.json'),
    );
  });

  it('should not not copy files when same size and multihash', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
          unique: 'fileA',
        },
      }),
      fsa.write('memory://target/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
          unique: 'fileB',
        },
      }),
    ]);
    await worker.routes.copy({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      start: 0,
      size: 1,
      force: true,
      noClobber: true,
      fixContentType: false,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json');

    assert.equal(jsonTarget?.metadata?.['unique'], 'fileB');
  });

  it('should copy files when same size but different multihashes', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: 'a' })), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: '12201c7836b489f13dc3f29a2222fb3dc4079085fe07ef51a3e0f7a215fadf364031',
          unique: 'fileA',
        },
      }),
      fsa.write('memory://target/topographic.json', Buffer.from(JSON.stringify({ test: 'b' })), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: fakeMultihash,
          unique: 'fileB',
        },
      }),
    ]);
    await worker.routes.copy({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      start: 0,
      size: 1,
      force: true,
      noClobber: true,
      fixContentType: false,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json');
    assert.equal(jsonTarget?.metadata?.['unique'], 'fileA');
  });

  it('should copy files when same size but no multihash', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fileA',
        },
      }),
      fsa.write('memory://target/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
        metadata: { unique: 'fileB' },
      }),
    ]);
    await worker.routes.copy({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      start: 0,
      size: 1,
      force: true,
      noClobber: true,
      fixContentType: false,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json');

    assert.equal(jsonTarget?.metadata?.['unique'], 'fileA');
    assert.equal(
      jsonTarget?.metadata?.['multihash'],
      '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
    );
  });
});
