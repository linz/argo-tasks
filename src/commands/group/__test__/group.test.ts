import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { StrList, Url } from '../../common.ts';
import type { CommandGroupArgs } from '../group.ts';
import { commandGroup, groupItems } from '../group.ts';

describe('groupItems', () => {
  it('should group items', () => {
    assert.deepEqual(groupItems([1, 2, 3, 4], 2), [
      [1, 2],
      [3, 4],
    ]);

    assert.deepEqual(groupItems([1, 2, 3, 4], 3), [[1, 2, 3], [4]]);
  });

  it('should group max', () => {
    assert.deepEqual(groupItems([1, 2, 3, 4], 100), [[1, 2, 3, 4]]);
  });

  it('should group min', () => {
    assert.deepEqual(groupItems([1, 2, 3, 4], 1), [[1], [2], [3], [4]]);
  });
});

describe('group', () => {
  const memoryFs = new FsMemory();
  beforeEach(() => {
    fsa.register('file:///tmp/group', memoryFs);
    memoryFs.files.clear();
  });
  const defaultValues: CommandGroupArgs = {
    config: undefined,
    verbose: false,
    fromFile: undefined,
    forceOutput: false,
    size: 0,
    inputs: [],
  };

  it('should load from a JSON array', async () => {
    await commandGroup.handler({
      ...defaultValues,
      inputs: [await StrList.from(JSON.stringify([1, 2, 3, 4]))],
      forceOutput: true,
      size: 50,
    });
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output.json')), ['000']);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/000.json')), [1, 2, 3, 4]);
  });

  it('should load from multiple JSON arrays', async () => {
    const cliArgs: CommandGroupArgs = {
      ...defaultValues,
      inputs: [await StrList.from(JSON.stringify([JSON.stringify([1, 2, 3, 4]), JSON.stringify(['alpha'])]))],
      forceOutput: true,
      size: 3,
    };
    await commandGroup.handler(cliArgs);

    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output.json')), ['000', '001']);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/000.json')), [1, 2, 3]);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/001.json')), [4, 'alpha']);
  });

  it('should load from strings', async () => {
    await commandGroup.handler({
      ...defaultValues,
      inputs: [
        await StrList.from(JSON.stringify(['s3://foo/bar', JSON.stringify([1, 2, 3, 4]), JSON.stringify(['alpha'])])),
      ],
      forceOutput: true,
      size: 3,
    });
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output.json')), ['000', '001']);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/000.json')), ['s3://foo/bar', 1, 2]);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/001.json')), [3, 4, 'alpha']);
  });

  it('should load from a file', async () => {
    await fsa.write(fsa.toUrl('/tmp/group/input.json'), Buffer.from(JSON.stringify([1, 2, 3, 4, 5])));

    await commandGroup.handler({
      ...defaultValues,
      inputs: [],
      fromFile: await Url.from('/tmp/group/input.json'),
      forceOutput: true,
      size: 3,
      config: undefined,
      verbose: false,
    });
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output.json')), ['000', '001']);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/000.json')), [1, 2, 3]);
    assert.deepEqual(await fsa.readJson(fsa.toUrl('/tmp/group/output/001.json')), [4, 5]);
  });
});
