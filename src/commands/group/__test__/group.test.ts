import { fsa, FsMemory } from '@chunkd/fs';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { StrList, Url } from '../../common.ts';
import type { CommandGroupArgs } from '../group.ts';
import { commandGroup } from '../group.ts';

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
    groupSize: undefined,
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

describe('group --group-size', () => {
  const memoryFs = new FsMemory();
  const sourceFs = new FsMemory();
  beforeEach(() => {
    fsa.register('file:///tmp/group', memoryFs);
    fsa.register('memory://source/', sourceFs);
    memoryFs.files.clear();
    sourceFs.files.clear();
  });

  /** tile-index-validate style item, with an input file of each size */
  async function item(output: string, ...inputs: [string, number][]): Promise<{ output: string; input: string[] }> {
    for (const [name, size] of inputs) await fsa.write(fsa.toUrl(`memory://source/${name}`), Buffer.alloc(size));
    return { output, input: inputs.map(([name]) => `memory://source/${name}`) };
  }

  async function runGroup(items: unknown[], size: number, groupSize: string): Promise<unknown[][]> {
    await fsa.write(fsa.toUrl('/tmp/group/input.json'), Buffer.from(JSON.stringify(items)));
    await commandGroup.handler({
      config: undefined,
      verbose: false,
      forceOutput: true,
      inputs: [],
      fromFile: await Url.from('/tmp/group/input.json'),
      size,
      groupSize,
    });
    const ids = await fsa.readJson<string[]>(fsa.toUrl('/tmp/group/output.json'));
    return Promise.all(ids.map((id) => fsa.readJson<unknown[]>(fsa.toUrl(`/tmp/group/output/${id}.json`))));
  }

  it('should close a group on the item that reaches the size, overshooting by one large item', async (t) => {
    const a = await item('a', ['x/a.tiff', 4]);
    const big = await item('big', ['x/big.tiff', 20]);
    const b = await item('b', ['y/b1.tiff', 2], ['y/b2.tiff', 2]);
    const c = await item('c', ['y/c.tiff', 4]);
    const d = await item('d', ['y/d.tiff', 4]);
    const details = t.mock.method(sourceFs, 'details');

    // a + big = 24 bytes, b + c + d = 12 bytes
    assert.deepEqual(await runGroup([a, big, b, c, d], 50, '10'), [
      [a, big],
      [b, c, d],
    ]);
    // One listing per input folder
    assert.equal(details.mock.callCount(), 2);
  });

  it('should close a group at --size before --group-size', async () => {
    const items = [await item('a', ['a.tiff', 4]), await item('b', ['b.tiff', 4]), await item('c', ['c.tiff', 4])];
    assert.deepEqual(await runGroup(items, 2, '1Gi'), [[items[0], items[1]], [items[2]]]);
  });

  it('should group by count when there are no sizes', async () => {
    const missing = { output: 'missing', input: ['memory://source/missing.tiff'] };
    assert.deepEqual(await runGroup(['a', missing, 'b'], 2, '10'), [['a', missing], ['b']]);
  });
});
