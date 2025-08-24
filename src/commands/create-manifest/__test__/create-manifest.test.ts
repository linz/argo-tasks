import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';

import { fsa, FsMemory } from '@chunkd/fs';
import { parse } from 'cmd-ts';

import type { CommandArguments } from '../../../__test__/type.util.ts';
import { Url, UrlFolder, UrlFolderList } from '../../common.ts';
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
      fsa.write(await Url.from('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(await Url.from('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
    ]);

    const outputFiles = await createManifest(
      [await Url.from('memory://source/')],
      await UrlFolder.from('memory://target/'),
      { flatten: true },
    );
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
      fsa.write(await Url.from('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(await Url.from('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
    ]);
    const outputFiles = await createManifest(
      await UrlFolderList.from('memory://source/'),
      await UrlFolder.from('memory://target/sub/'),
      {
        flatten: false,
        transform: 'f.replace("topographic", "test")',
      },
    );
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
      fsa.write(await Url.from('memory://source/topographic.json'), Buffer.from(JSON.stringify({ test: true }))),
      fsa.write(await Url.from('memory://source/foo/bar/topographic.png'), Buffer.from('test')),
    ]);

    const outputFiles = await createManifest(
      [await Url.from('memory://source/')],
      await UrlFolder.from('memory://target/sub/'),
      { flatten: false },
    );
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
      [await Url.from('memory://source/topographic.json')],
      await Url.from('memory://target/sub/topographic.json'),
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
        validatePaths(new URL('memory://source/'), new URL('memory://target/sub/test.tiff'));
      }, Error);
    });
    it('Should also throw error for mismatched paths', () => {
      assert.throws(() => {
        validatePaths(new URL('memory://source/test.tiff'), new URL('memory://target/sub/'));
      }, Error);
    });
  });

  it('should parse required options', async () => {
    const parsed = (await parse(
      commandCreateManifest,
      [
        ['--output', 'memory://output/🦄 🌈.json'],
        ['--target', 'memory://target/🟪/🦄 🌈'],
        'memory://source/🟥/',
      ].flat(),
    )) as { _tag: 'ok'; value: CommandCreateManifestArgs };
    assert.equal(parsed._tag, 'ok');
    assert.deepEqual(parsed.value.source, [[new URL('memory://source/🟥/')]]);
    assert.deepEqual(parsed.value.target, new URL('memory://target/🟪/🦄 🌈/')); // adds trailing slash
    assert.deepEqual(parsed.value.output, new URL('memory://output/🦄 🌈.json'));
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
    output: Url.from('manifest.json'),
    target: UrlFolder.from(''),
    source: [],
  };

  it('should generate a output', async () => {
    await fsa.write(await Url.from('memory://source/🟥/🦄 🌈.txt'), Buffer.alloc(1));
    await fsa.write(await Url.from('memory://source/🟥/🦄 🌈.json'), Buffer.alloc(0));

    await commandCreateManifest.handler({
      ...baseArgs,
      source: [await UrlFolderList.from('memory://source/🟥/')],
      target: await UrlFolder.from('memory://target/🟪/'),
      output: await Url.from('memory://output/🦄 🌈.json'),
    });

    // output is a JSON array of base64'd GZIPED json
    // [ "H4sIAA...", "H4sIAA...."]
    const output = JSON.parse(
      (await fsa.read(await Url.from('memory://output/🦄 🌈.json'))).toString('utf-8'),
    ) as string[];
    assert.ok(Array.isArray(output));
    const firstBytes = JSON.parse(
      gunzipSync(Buffer.from(output[0] as string, 'base64url')).toString('utf-8'),
    ) as SourceTarget[][];

    assert.deepEqual(firstBytes, [
      {
        source: 'memory://source/🟥/🦄 🌈.txt',
        target: 'memory://target/🟪/🦄 🌈.txt',
      },
    ]);
  });
});
