import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { worker } from '../delete-worker.ts';

describe('deleteFiles', () => {
  const memory = new FsMemory();
  fsa.register('memory://', memory);

  beforeEach(() => {
    memory.files.clear();
  });

  it('should delete from the target location', async () => {
    // Writing files to be deleted
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/json',
      }),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test'), { contentType: 'image/png' }),
    ]);

    // Delete files
    await worker.routes.delete({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
        {
          source: 'memory://source/foo/bar/topographic.png',
          target: 'memory://target/topographic.png',
        },
      ],
      start: 0,
      size: 2,
      dryRun: false,
    });

    // Check if files have been deleted
    const [jsonFile, pngFile] = await Promise.all([
      fsa.head('memory://source/topographic.json'),
      fsa.head('memory://source/topographic.png'),
    ]);

    assert.equal(jsonFile, null);
    assert.equal(pngFile, null);
  });

  it('should not delete files in dry run mode', async () => {
    // Write the files to be deleted
    await Promise.all([
      fsa.write('memory://source/topographic.json', Buffer.from(JSON.stringify({ test: true })), {
        contentType: 'application/json',
      }),
      fsa.write('memory://source/foo/bar/topographic.png', Buffer.from('test'), { contentType: 'image/png' }),
    ]);

    // Perform dry run delete operation
    await worker.routes.delete({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json',
          target: 'memory://target/topographic.json',
        },
        {
          source: 'memory://source/foo/bar/topographic.png',
          target: 'memory://target/foo/bar/topographic.png',
        },
      ],
      start: 0,
      size: 2,
      dryRun: true,
    });

    // Check if files still exist
    const [jsonFile, pngFile] = await Promise.all([
      fsa.head('memory://source/topographic.json'),
      fsa.head('memory://source/foo/bar/topographic.png'),
    ]);

    assert.notEqual(jsonFile, null);
    assert.notEqual(pngFile, null);
  });

  it('should skip missing files when deleting', async () => {
    const result = await worker.routes.delete({
      id: '1',
      manifest: [
        {
          source: 'memory://source/topographic.json', // This file does not exist
          target: 'memory://target/topographic.json',
        },
      ],
      start: 0,
      size: 1,
      dryRun: false,
    });

    assert.deepEqual(result, { deleted: 0, skipped: 1 });
  });
});
