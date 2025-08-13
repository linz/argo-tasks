import assert from 'node:assert';
import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import type { ActionCopy } from '../../../utils/actions.ts';
import { urlToString } from '../../common.ts';
import type { CommandCreateManifestArgs } from '../../create-manifest/create-manifest.ts';
import { commandCreateManifest } from '../../create-manifest/create-manifest.ts';
import { commandCopy, type CommandCopyArgs } from '../copy.ts';

describe('createManifest.Copy.E2E', () => {
  /**
   * As this test uses sub processes we cannot just write to memory://
   * we need to use an actual file system
   */
  const sourceLocation = pathToFileURL('./.test/');

  const memory = new FsMemory();
  beforeEach(() => {
    fsa.register('memory://', memory);
    // action-location assumes s3
    fsa.register('s3://', memory);

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
    output: '',
    target: '',
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
    const mkPath = (str: string): URL => new URL(str, sourceLocation);
    await fsa.write(mkPath(`source/🟥/🦄 🌈.txt`), Buffer.alloc(1));
    await fsa.write(mkPath(`source/🟥/🦄 🌈.json`), Buffer.alloc(2));
    await fsa.write(mkPath(`source/🟥/🟧/🌈.pdf`), Buffer.alloc(3));
    await fsa.write(mkPath(`source/🟥/🟧/🌈.tiff`), Buffer.alloc(4));

    // TODO do we need a "action" logic and a compressed file logic?
    process.env['ACTION_PATH'] = `memory://actions/🟥/actions/`;

    await commandCreateManifest.handler({
      ...baseManifestArgs,
      group: 2,
      source: [mkPath('source/🟥')],
      target: mkPath('target/'),
      output: './.test/🦄 🌈.manifest.json',
    });

    const basePath = urlToString(sourceLocation);

    const manifest = await fsa.readJson<string[]>('./.test/🦄 🌈.manifest.json');

    assert.equal(manifest.length, 2);
    const firstManifestUrl = manifest[0] as string;
    const firstManifest = await fsa.readJson<ActionCopy>(firstManifestUrl);
    assert.equal(firstManifest.action, 'copy');
    assert.deepEqual(
      firstManifest.parameters.manifest.map((m) => {
        return { source: m.source.slice(basePath.length), target: m.target.slice(basePath.length) };
      }),
      [
        {
          source: 'source/🟥/🟧/🌈.pdf',
          target: 'target/🟧/🌈.pdf',
        },
        {
          source: 'source/🟥/🟧/🌈.tiff',
          target: 'target/🟧/🌈.tiff',
        },
      ],
    );

    await commandCopy.handler({ ...baseCopyArgs, manifest: [firstManifestUrl] });

    async function getAllFiles(): Promise<[string, number][]> {
      const files = await fsa.toArray(fsa.details(basePath));
      const filesShort: [string, number][] = files.map((m) => [m.path.slice(basePath.length), m.size ?? 0]);
      filesShort.sort((a, b) => a[0].localeCompare(b[0]));

      return filesShort;
    }

    assert.deepEqual(await getAllFiles(), [
      ['🦄 🌈.manifest.json', 197],
      ['source/🟥/🦄 🌈.json', 2],
      ['source/🟥/🦄 🌈.txt', 1],
      ['source/🟥/🟧/🌈.pdf', 3],
      ['source/🟥/🟧/🌈.tiff', 4],

      // Only the first part of the source has been copied
      ['target/🟧/🌈.pdf', 3],
      ['target/🟧/🌈.tiff', 4],
    ]);

    await commandCopy.handler({ ...baseCopyArgs, force: true, manifest });

    assert.deepEqual(await getAllFiles(), [
      ['🦄 🌈.manifest.json', 197],
      ['source/🟥/🦄 🌈.json', 2],
      ['source/🟥/🦄 🌈.txt', 1],
      ['source/🟥/🟧/🌈.pdf', 3],
      ['source/🟥/🟧/🌈.tiff', 4],

      ['target/🦄 🌈.json', 2],
      ['target/🦄 🌈.txt', 1],
      ['target/🟧/🌈.pdf', 3],
      ['target/🟧/🌈.tiff', 4],
    ]);
  });
});
