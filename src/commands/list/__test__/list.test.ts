import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { logger } from '../../../log.ts';
import type { CommandArguments } from '../../../utils/type.util.ts';
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

  it('should list local filesystem folder as absolute paths and not as file URLs', async () => {
    fsa.register(`file://${process.cwd()}/.listtest`, mem); // test on a subfolder of cwd()
    fsa.register(`file:///other/path`, mem); // and an arbitrary file URL.
    await fsa.write(fsa.toUrl(`${process.cwd()}/.listtest/a.txt`), Buffer.alloc(1));
    await fsa.write(fsa.toUrl(`${process.cwd()}/.listtest/b.txt`), Buffer.alloc(1));
    await fsa.write(fsa.toUrl(`file:///other/path/.listtest/c.txt`), Buffer.alloc(1));
    await fsa.write(fsa.toUrl(`file:///other/path/.listtest/d.txt`), Buffer.alloc(1));
    await commandList.handler({
      ...baseArgs,
      location: [[fsa.toUrl(`${process.cwd()}/.listtest/`), fsa.toUrl('file:///other/path/')]],
      output: fsa.toUrl('memory://host/output.json'),
    });

    const output = await fsa.readJson(fsa.toUrl('memory://host/output.json'));
    assert.deepEqual(output, [
      [
        `${process.cwd()}/.listtest/a.txt`,
        `${process.cwd()}/.listtest/b.txt`,
        '/other/path/.listtest/c.txt',
        '/other/path/.listtest/d.txt',
      ],
    ]);
  });

  it('should list a folder', async () => {
    await fsa.write(fsa.toUrl(`memory://some-bucket/test/🦄 🌈.txt`), Buffer.alloc(1));
    await commandList.handler({
      ...baseArgs,
      location: [[fsa.toUrl('memory://some-bucket/test/')]],
      output: fsa.toUrl('memory://host/🦄 🌈/output.json'),
    });

    const allFiles = [...mem.files.keys()].map((f) => decodeURI(f));
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
      location: [[fsa.toUrl('memory://some-bucket/🦄/'), fsa.toUrl('memory://some-bucket/🌈/')]],
      output: fsa.toUrl('memory://host/🦄 🌈/output.json'),
      group: 1,
    });

    const fileList = JSON.parse(
      (await mem.read(fsa.toUrl('memory://host/🦄 🌈/output.json'))).toString('utf-8'),
    ) as string[][];
    assert.deepEqual(fileList, [['memory://some-bucket/🦄/🦄 🌈.txt'], ['memory://some-bucket/🌈/🦄 🌈.txt']]);
  });

  it('should ignore empty files from ; separated lists', async () => {
    await fsa.write(fsa.toUrl(`memory://some-bucket/🦄/🦄 🌈.txt`), Buffer.alloc(1));
    await fsa.write(fsa.toUrl(`memory://some-bucket/🌈/🦄 🌈.txt`), Buffer.alloc(0));
    await commandList.handler({
      ...baseArgs,
      location: [[fsa.toUrl('memory://some-bucket/🦄/'), fsa.toUrl('memory://some-bucket/🌈/')]],
      output: fsa.toUrl('memory://host/🦄 🌈/output.json'),
      group: 1,
    });
    const outputJsonFileContent = JSON.parse(
      (await mem.read(fsa.toUrl('memory://host/🦄 🌈/output.json'))).toString('utf-8'),
    ) as string[][];
    assert.deepEqual(outputJsonFileContent, [['memory://some-bucket/🦄/🦄 🌈.txt']]);
  });
});
