import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { MinSizeForCompression } from '../copy-helpers.ts';
import type { CopyStats } from '../copy-rpc.ts';
import { worker } from '../copy-worker.ts';

const defaultCopyArgs = {
  id: '1',
  manifest: [],
  start: 0,
  size: 10,
  force: false,
  noClobber: false,
  fixContentType: false,
  compress: false,
  decompress: false,
  deleteSource: false,
};

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
      ...defaultCopyArgs,
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

  it('should default to COG/json when fixContentType = true', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/octet-stream',
      }),
      fsa.write('memory://source/foo/bar/topographic.tiff', Buffer.from('test'), {
        contentType: 'binary/octet-stream',
      }),
    ]);
    await worker.routes.copy({
      ...defaultCopyArgs,
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
      ...defaultCopyArgs,
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
        ...defaultCopyArgs,
        manifest: [
          {
            source: 'memory://source/topographic.json',
            target: 'memory://target/topographic.json',
          },
        ],
        noClobber: true,
        force: false,
      }),
      new Error(
        'Target already exists with different hash. Use --force to overwrite. target: memory://target/topographic.json source: memory://source/topographic.json',
      ),
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
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      force: true,
      noClobber: true,
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
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      force: true,
      noClobber: true,
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
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      force: true,
      noClobber: true,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json');

    assert.equal(jsonTarget?.metadata?.['unique'], 'fileA');
    assert.equal(
      jsonTarget?.metadata?.['multihash'],
      '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
    );
  });

  it('should copy and compress files when compress flag is set and file is large enough', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fileA',
        },
      }),
    ]);
    await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      compress: true,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json.zst');

    assert.equal(
      jsonTarget?.metadata?.['multihash'],
      '1220c38c2bf3055c516a98ac5d97f30e7c364e827bc0199e1c3415b794afbe55dcad',
    );
  });

  it('should copy and NOT compress files when compress flag is set and file is small', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression - 1, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fileA',
        },
      }),
    ]);
    await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      compress: true,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json');

    assert.strictEqual(jsonTarget?.contentEncoding, undefined);
    assert.equal(
      jsonTarget?.metadata?.['multihash'],
      '12200fc49e10ee7035ce7eefb2704762528e9b2a9038b4cff25794bab02402727952',
    );
  });

  it('should skip copy files when compress and same multihash even if target size mismatches source size', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fileA',
          multihash: fakeMultihash,
        },
      }),
      fsa.write('memory://target/topographic.json.zst', Buffer.alloc(MinSizeForCompression / 10, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fakeCompressed',
          multihash: fakeMultihash,
        },
      }),
    ]);
    await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      force: false,
      noClobber: true,
      compress: true,
    });
    const jsonTarget = await fsa.head('memory://target/topographic.json.zst');

    assert.equal(jsonTarget?.metadata?.['unique'], 'fakeCompressed');
  });
  it('should delete source files after copy when delete flag is set', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/json',
      }),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test'), { contentType: 'image/png' }),
    ]);

    await worker.routes.copy({
      ...defaultCopyArgs,
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
      deleteSource: true,
    });

    const [pngSource, jsonSource] = await Promise.all([
      fsa.head('memory://source/foo/bar/topographic.png'),
      fsa.head('memory://source/topographic.json'),
    ]);
    assert.strictEqual(jsonSource, null);
    assert.strictEqual(pngSource, null);
  });

  it('should delete source files after skipped copy when delete flag is set and copy was skipped due to same hash', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression * 10, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fileA',
          multihash: fakeMultihash,
        },
      }),
      fsa.write('memory://target/topographic.json', Buffer.alloc(MinSizeForCompression * 10, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          unique: 'fileB',
          multihash: fakeMultihash,
        },
      }),
    ]);
    await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      force: false,
      noClobber: true,
      deleteSource: true,
    });
    const [jsonSource, jsonTarget] = await Promise.all([
      fsa.head('memory://source/topographic.json'),
      fsa.head('memory://target/topographic.json'),
    ]);

    assert.strictEqual(jsonSource, null);
    assert.equal(jsonTarget?.metadata?.['unique'], 'fileB'); // fileB ==> has not been updated
  });

  it('should increment stats for compressed and uncompressed files and totals', async () => {
    await Promise.all([
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.alloc(MinSizeForCompression, 'x'), {
        contentType: 'image/png',
      }),
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression - 1, 'x'), {
        contentType: 'application/octet-stream',
      }),
    ]);
    const stats: CopyStats = await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/foo/bar/topographic.png',
          target: 'memory://target/foo/bar/topographic.png',
        },
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      compress: true,
    });
    assert.equal(stats.decompressed.count, '0');
    assert.equal(stats.compressed.count, '1');
    assert.equal(stats.copied.count, '1');
    assert.equal(stats.processed.count, '2');
    assert.equal(stats.grandTotal.count, '2');
  });
  it('should decompress files and increment stats for decompressed and uncompressed files and totals', async () => {
    await Promise.all([
      fsa.write('memory://temp/topographic.png', Buffer.alloc(MinSizeForCompression, 'x'), {
        contentType: 'image/png',
      }),
      fsa.write('memory://temp/topographic.tif', Buffer.alloc(MinSizeForCompression * 2, 'x'), {}),
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression - 1, 'x'), {
        contentType: 'application/octet-stream',
      }),
    ]);
    await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://temp/topographic.png',
          target: 'memory://source/topographic.png',
        },
        {
          source: 'memory://temp/topographic.tif',
          target: 'memory://source/topographic.tif',
        },
      ],
      compress: true,
    });
    const stats = await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.png.zst',
          target: 'memory://target/topographic.png.zst',
        },
        {
          source: 'memory://source/topographic.tif.zst',
          target: 'memory://target/topographic.tif.zst',
        },
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      decompress: true,
    });
    const tiffTarget = await fsa.head('memory://target/topographic.tif');
    assert.equal(tiffTarget?.contentType, 'image/tiff; application=geotiff; profile=cloud-optimized');

    assert.equal(stats.compressed.count, '0');
    assert.equal(stats.decompressed.count, '2');
    assert.equal(stats.copied.count, '1');
    assert.equal(stats.processed.count, '3');
    assert.equal(stats.grandTotal.count, '3');
  });
  it('should increment stats for skipped files and totals', async () => {
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.alloc(MinSizeForCompression - 1, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: fakeMultihash,
        },
      }),
      fsa.write('memory://target/topographic.json', Buffer.alloc(MinSizeForCompression - 1, 'x'), {
        contentType: 'application/octet-stream',
        metadata: {
          multihash: fakeMultihash,
        },
      }),
    ]);
    const stats: CopyStats = await worker.routes.copy({
      ...defaultCopyArgs,
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
      ],
      noClobber: true,
    });
    assert.equal(stats.skipped.count, '1');
    assert.equal(stats.grandTotal.count, '1');
    assert.equal(stats.processed.count, '0');
  });
});
