import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import type { ActionCopy } from '../../../utils/actions.ts';
import { makeRelative } from '../../../utils/filelist.ts';
import { Url, UrlFolder, UrlFolderList, UrlList } from '../../common.ts';
import type { CommandCreateManifestArgs } from '../../create-manifest/create-manifest.ts';
import { commandCreateManifest } from '../../create-manifest/create-manifest.ts';
import { commandCopy, type CommandCopyArgs } from '../copy.ts';
const sourceLocation = pathToFileURL('./.test/');

/**
 * Get all files and their sizes in the test directory
 */
async function getAllFiles(): Promise<[string, number][]> {
  const files = await fsa.toArray(fsa.details(sourceLocation));
  const filesShort: [string, number][] = files.map((m) => [
    makeRelative(pathToFileURL('./'), m.url, false),
    m.size ?? 0,
  ]);
  filesShort.sort((a, b) => a[0].localeCompare(b[0]));

  return filesShort;
}

describe('createManifest.Copy.E2E', () => {
  /**
   * As this test uses sub processes we cannot just write to memory://
   * we need to use an actual file system
   */

  const memory = new FsMemory();
  beforeEach(() => {
    fsa.register('memory://', memory);
    memory.files.clear();
  });

  afterEach(async () => {
    await rm(sourceLocation, { recursive: true, force: true });
  });

  const baseManifestArgs: CommandCreateManifestArgs = {
    config: undefined,
    verbose: false,
    flatten: false,
    transform: undefined,
    include: undefined,
    exclude: undefined,
    groupSize: undefined,
    group: undefined,
    limit: undefined,
    output: fsa.toUrl('manifest.json'),
    target: fsa.toUrl('./'),
    actionLocation: fsa.toUrl('memory://actions/🟥/actions/'),
    source: [],
  };
  const baseCopyArgs: CommandCopyArgs = {
    config: undefined,
    verbose: false,
    force: false,
    noClobber: false,
    forceNoClobber: false,
    fixContentType: false,
    compress: false,
    decompress: false,
    deleteSource: false,
    concurrency: 1,
    manifest: [],
  };

  it('should create a manifest and copy some files', async () => {
    await fsa.write(new URL(`source/🟥/🦄 🌈.txt`, sourceLocation), Buffer.from('1', 'utf8'));
    await fsa.write(new URL(`source/🟥/🦄 🌈.json`, sourceLocation), Buffer.from('22', 'utf8'));
    await fsa.write(new URL(`source/🟥/🟧/🌈.pdf`, sourceLocation), Buffer.from('333', 'utf8'));
    await fsa.write(new URL(`source/🟥/🟧/🌈.tiff`, sourceLocation), Buffer.from('4444', 'utf8'));

    await commandCreateManifest.handler({
      ...baseManifestArgs,
      group: 2,
      source: [await UrlFolderList.from('.test/source/🟥')],
      target: await UrlFolder.from('.test/target/'),
      output: await Url.from('./.test/🦄 🌈.manifest.json'),
    });

    const manifestUrl = fsa.toUrl('./.test/🦄 🌈.manifest.json');
    const manifest = await fsa.readJson<string[]>(manifestUrl);

    assert.equal(manifest.length, 2);
    const firstManifestUrl = await Url.from(manifest[0] as string);
    const firstManifest = await fsa.readJson<ActionCopy>(firstManifestUrl);
    assert.equal(firstManifest.action, 'copy');
    assert.deepEqual(firstManifest.parameters.manifest, [
      {
        source: './.test/source/🟥/🟧/🌈.pdf',
        target: './.test/target/🟧/🌈.pdf',
      },
      {
        source: './.test/source/🟥/🟧/🌈.tiff',
        target: './.test/target/🟧/🌈.tiff',
      },
    ]);

    await commandCopy.handler({ ...baseCopyArgs, manifest: await UrlList.from(manifest[0] as string) });

    assert.deepEqual(await getAllFiles(), [
      ['./.test/🦄 🌈.manifest.json', 181],
      ['./.test/source/🟥/🦄 🌈.json', 2],
      ['./.test/source/🟥/🦄 🌈.txt', 1],
      ['./.test/source/🟥/🟧/🌈.pdf', 3],
      ['./.test/source/🟥/🟧/🌈.tiff', 4],

      // Only the first part of the source has been copied
      ['./.test/target/🟧/🌈.pdf', 3],
      ['./.test/target/🟧/🌈.tiff', 4],
    ]);

    await commandCopy.handler({ ...baseCopyArgs, force: true, manifest: await UrlList.from(manifest) });
    assert.deepEqual(await getAllFiles(), [
      ['./.test/🦄 🌈.manifest.json', 181],
      ['./.test/source/🟥/🦄 🌈.json', 2],
      ['./.test/source/🟥/🦄 🌈.txt', 1],
      ['./.test/source/🟥/🟧/🌈.pdf', 3],
      ['./.test/source/🟥/🟧/🌈.tiff', 4],

      ['./.test/target/🦄 🌈.json', 2],
      ['./.test/target/🦄 🌈.txt', 1],
      ['./.test/target/🟧/🌈.pdf', 3],
      ['./.test/target/🟧/🌈.tiff', 4],
    ]);
  });
});
