import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { commandGroup, groupItems } from '../group.js';

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
    await commandGroup.handler({ inputs: [JSON.stringify([1, 2, 3, 4])], forceOutput: true, size: 50 } as any);
    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), [[1, 2, 3, 4]]);
  });

  it('should load from multiple JSON arrays', async () => {
    await commandGroup.handler({
      inputs: [JSON.stringify([1, 2, 3, 4]), JSON.stringify(['alpha'])],
      forceOutput: true,
      size: 3,
    } as any);
    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), [
      [1, 2, 3],
      [4, 'alpha'],
    ]);
  });
  it('should load from strings', async () => {
    await commandGroup.handler({
      inputs: ['s3://foo/bar', JSON.stringify([1, 2, 3, 4]), JSON.stringify(['alpha'])],
      forceOutput: true,
      size: 3,
    } as any);
    assert.deepEqual(await fsa.readJson('/tmp/group/output.json'), [
      ['s3://foo/bar', 1, 2],
      [3, 4, 'alpha'],
    ]);
  });
});
