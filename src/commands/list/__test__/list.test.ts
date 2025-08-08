import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { logger } from '../../../log.ts';
import { commandList } from '../list.ts';

type CommandArguments<C> = C extends { handler: (args: infer A) => unknown } ? A : never;
type CommandListArgs = CommandArguments<typeof commandList>;

describe('command.list', () => {
  const mem = new FsMemory();

  beforeEach(() => {
    fsa.register('m://', mem);
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
    await fsa.write(`m://some-bucket/test/🦄 🌈.txt`, Buffer.alloc(1));
    await commandList.handler({
      ...baseArgs,
      location: ['m://some-bucket/test/'],
      output: 'm://🦄 🌈/output.json',
    });

    const allFiles = [...mem.files.keys()];
    assert.deepEqual(allFiles, ['m://some-bucket/test/🦄 🌈.txt', 'm://🦄 🌈/output.json']);
    const fileList = JSON.parse((await mem.read('m://🦄 🌈/output.json')).toString('utf-8')) as string[][];
    assert.deepEqual(fileList, [[`m://some-bucket/test/🦄 🌈.txt`]]);
  });

  it('should list folders from ; seperated lists', async () => {
    await fsa.write(`m://some-bucket/🦄/🦄 🌈.txt`, Buffer.alloc(1));
    await fsa.write(`m://some-bucket/🌈/🦄 🌈.txt`, Buffer.alloc(1));

    await commandList.handler({
      ...baseArgs,
      location: ['m://some-bucket/🦄/;m://some-bucket/🌈/'],
      output: 'm://🦄 🌈/output.json',
      group: 1,
    });

    const fileList = JSON.parse((await mem.read('m://🦄 🌈/output.json')).toString('utf-8')) as string[][];
    assert.deepEqual(fileList, [['m://some-bucket/🦄/🦄 🌈.txt'], ['m://some-bucket/🌈/🦄 🌈.txt']]);
  });

  it('should ignore empty files from ; seperated lists', async () => {
    await fsa.write(`m://some-bucket/🦄/🦄 🌈.txt`, Buffer.alloc(1));
    await fsa.write(`m://some-bucket/🌈/🦄 🌈.txt`, Buffer.alloc(0));

    await commandList.handler({
      ...baseArgs,
      location: ['m://some-bucket/🦄/;m://some-bucket/🌈/'],
      output: 'm://🦄 🌈/output.json',
      group: 1,
    });

    const fileList = JSON.parse((await mem.read('m://🦄 🌈/output.json')).toString('utf-8')) as string[][];
    assert.deepEqual(fileList, [['m://some-bucket/🦄/🦄 🌈.txt']]);
  });
});
