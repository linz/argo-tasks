import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import type { CommandArguments } from '../../../__test__/type.util.ts';
import { logger } from '../../../log.ts';
import { commandList } from '../list.ts';

type CommandListArgs = CommandArguments<typeof commandList>;

describe('command.list', () => {
  const mem = new FsMemory();

  beforeEach(() => {
    fsa.register('memory://', mem);
    mem.files.clear();
    logger.level = 'silent';
  });

  const baseArgs: CommandListArgs = {
    group: 0,
    config: undefined,
    verbose: false,
    include: undefined,
    exclude: undefined,
    groupSize: undefined,
    limit: undefined,
    output: undefined,
    location: [],
  };

  it('should list a folder', async () => {
    await fsa.write(fsa.toUrl(`memory://some-bucket/test/🦄 🌈.txt`), Buffer.alloc(1));
    await commandList.handler({
      ...baseArgs,
      location: ['memory://some-bucket/test/'],
      output: 'memory://host/🦄 🌈/output.json',
    });

    const allFiles = [...mem.files.keys()];
    assert.deepEqual(allFiles, ['memory://some-bucket/test/🦄 🌈.txt', 'memory://host/🦄 🌈/output.json']);
    const fileList = JSON.parse(
      (await mem.read(fsa.toUrl('memory://host/🦄 🌈/output.json'))).toString('utf-8'),
    ) as string[][];
    assert.deepEqual(fileList, [[`memory://some-bucket/test/🦄 🌈.txt`]]);
  });

  it('should list folders from ; separated lists', async () => {
    await fsa.write(fsa.toUrl(`memory://some-bucket/🦄/🦄 🌈.txt`), Buffer.alloc(1));
    await fsa.write(fsa.toUrl(`memory://some-bucket/🌈/🦄 🌈.txt`), Buffer.alloc(1));

    await commandList.handler({
      ...baseArgs,
      location: ['memory://some-bucket/🦄/;memory://some-bucket/🌈/'],
      output: 'memory://host/🦄 🌈/output.json',
      group: 1,
    });

    const fileList = JSON.parse((await mem.read(fsa.toUrl('memory://host/🦄 🌈/output.json'))).toString('utf-8')) as string[][];
    assert.deepEqual(fileList, [['memory://some-bucket/🦄/🦄 🌈.txt'], ['memory://some-bucket/🌈/🦄 🌈.txt']]);
  });

  it('should ignore empty files from ; separated lists', async () => {
    await fsa.write(fsa.toUrl(`memory://some-bucket/🦄/🦄 🌈.txt`), Buffer.alloc(1));
    await fsa.write(fsa.toUrl(`memory://some-bucket/🌈/🦄 🌈.txt`), Buffer.alloc(0));

    await commandList.handler({
      ...baseArgs,
      location: ['memory://some-bucket/🦄/;memory://some-bucket/🌈/'],
      output: 'memory://asd/🦄 🌈/output.json',
      group: 1,
    });
    const mypath = 'memory://host/🦄 🌈/output.json';
    const othernewthing = await fsa.read(fsa.toUrl(mypath));
    const newthing = await mem.read(fsa.toUrl(mypath));
    console.log(newthing, othernewthing);
    const fileList = JSON.parse((newthing).toString('utf-8')) as string[][];
    assert.deepEqual(fileList, [['memory://some-bucket/🦄/🦄 🌈.txt']]);
  });
});
