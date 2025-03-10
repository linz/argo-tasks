import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

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

  before(() => {
    fsa.register('/tmp/group', memoryFs);
  });

  it('should load from a JSON array', async () => {
    await commandGroup.handler({ inputs: [JSON.stringify([1, 2, 3, 4])], forceOutput: true, size: 50, ...values });
    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), ['000']);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/000.json'), [1, 2, 3, 4]);
  });

  const values = {
    config: undefined,
    verbose: false,
    fromFile: undefined,
  };

  it('should load from multiple JSON arrays', async () => {
    await commandGroup.handler({
      inputs: [JSON.stringify([1, 2, 3, 4]), JSON.stringify(['alpha'])],
      forceOutput: true,
      size: 3,
      ...values,
    });

    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), ['000', '001']);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/000.json'), [1, 2, 3]);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/001.json'), [4, 'alpha']);
  });

  it('should load from strings', async () => {
    await commandGroup.handler({
      inputs: ['s3://foo/bar', JSON.stringify([1, 2, 3, 4]), JSON.stringify(['alpha'])],
      forceOutput: true,
      size: 3,
      ...values,
    });
    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), ['000', '001']);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/000.json'), ['s3://foo/bar', 1, 2]);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/001.json'), [3, 4, 'alpha']);
  });

  it('should load from a file', async () => {
    await fsa.write('/tmp/group/input.json', Buffer.from(JSON.stringify([1, 2, 3, 4, 5])));
    await commandGroup.handler({
      inputs: [],
      fromFile: '/tmp/group/input.json',
      forceOutput: true,
      size: 3,
      config: undefined,
      verbose: false,
    });
    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), ['000', '001']);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/000.json'), [1, 2, 3]);
    assert.deepEqual(await fsa.readJson('/tmp/group/output/001.json'), [4, 5]);
  });
});
