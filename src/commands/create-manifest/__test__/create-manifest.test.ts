import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import type { CommandArguments } from '../../../__test__/type.util.ts';
import type { SourceTarget } from '../create-manifest.ts';
import { commandCreateManifest } from '../create-manifest.ts';
import { createManifest, validatePaths } from '../create-manifest.ts';

type CommandCreateManifestArgs = CommandArguments<typeof commandCreateManifest>;

describe('createManifest', () => {
  const memory = new FsMemory();
  beforeEach(() => {
    fsa.register('memory://', memory);
    memory.files.clear();
  });

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

  it('should copy single file to the target location without a trailing /', async () => {
    await Promise.all([fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })))]);

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

  const baseArgs: CommandCreateManifestArgs = {
    config: undefined,
    verbose: false,
    flatten: false,
    transform: undefined,
    include: undefined,
    exclude: undefined,
    groupSize: undefined,
    group: undefined,
    limit: undefined,
    output: '',
    target: '',
    source: [],
  };

  it('should generate a output', async () => {
    await fsa.write(`memory://some-bucket/🦄/🦄 🌈.txt`, Buffer.alloc(1));
    await fsa.write(`memory://some-bucket/🌈/🦄 🌈.txt`, Buffer.alloc(0));

    await commandCreateManifest.handler({
      ...baseArgs,
      source: ['memory://some-bucket/'],
      target: 'memory://target/🦄 🌈/',
      output: 'memory://output/🦄 🌈.json',
    });

    // output is a JSON array of base64'd GZIPED json
    // [ "H4sIAA...", "H4sIAA...."]
    const output = JSON.parse((await fsa.read('memory://output/🦄 🌈.json')).toString('utf-8')) as string[];
    assert.ok(Array.isArray(output));
    const firstBytes = JSON.parse(
      gunzipSync(Buffer.from(output[0] as string, 'base64url')).toString('utf-8'),
    ) as SourceTarget[][];

    assert.deepEqual(firstBytes, [
      {
        source: 'memory://some-bucket/🦄/🦄 🌈.txt',
        target: 'memory://target/🦄 🌈/🦄/🦄 🌈.txt',
      },
    ]);
  });
});
