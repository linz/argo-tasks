import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';

import { deleteEmptyFolders } from '../delete.empty.folders.ts';

/**
 * Create a directory tree in memory
 *
 * @param base The base path for the tree
 * @param structure The structure of the tree
 */
async function createTree(base: string, structure: Record<string, string | null>): Promise<void> {
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = `${base}${path}`;
    if (content === null) {
      await fsa.write(fullPath, '');
    } else {
      await fsa.write(fullPath, content);
    }
  }
}

describe('deleteEmptyFolders', () => {
  const memFs = new FsMemory();
  const base = 'memory://base/';

  beforeEach(async () => {
    fsa.systems.length = 0;
    fsa.register('memory://', memFs);
    memFs.files.clear();
    await fsa.write(base, '');
  });

  it('should delete empty folders recursively', async () => {
    await createTree(base, {
      'a/': null,
      'a/b/': null,
      'a/b/c/': null,
      'a/b/file.txt': 'data',
      'd/': null,
      'e/': null,
    });
    await deleteEmptyFolders(new URL(base), false);
    const files = await fsa.toArray(fsa.list(base));
    assert(!files.includes(base + 'a/b/c/'), 'a/b/c/ should be deleted');
    assert(files.includes(base + 'a/b/'), 'a/b/ should still exist (not empty)');
  });

  it('should not delete non-empty folders', async () => {
    await createTree(base, {
      'x/': null,
      'x/file.txt': 'data',
    });
    await deleteEmptyFolders(new URL(base), false);
    const files = await fsa.toArray(fsa.list(base));
    assert(files.includes(base + 'x/'), 'x/ should not be deleted');
  });

  it('should not delete files with trailing slashes', async () => {
    await createTree(base, {
      'x/': 'data',
    });
    await deleteEmptyFolders(new URL(base), false);
    const files = await fsa.toArray(fsa.list(base));
    assert(files.includes(base + 'x/'), 'x/ should not be deleted');
  });

  it('should delete the base folder', async () => {
    await createTree(base, {
      'x/': null,
    });
    await deleteEmptyFolders(new URL(base), false);
    const files = await fsa.toArray(fsa.list('memory://'));
    assert(!files.includes(base), 'base/ should be deleted');
  });

  it('should do nothing in dryRun mode (default)', async () => {
    await createTree(base, {
      'y/': null,
    });
    await deleteEmptyFolders(new URL(base));
    const files = await fsa.toArray(fsa.list(base));
    assert(files.includes(base + 'y/'), 'y/ should not be deleted in dryRun');
  });

  it('should return the list of deleted folders', async () => {
    await createTree(base, {
      'empty1/': null,
      'empty2/': null,
      'notEmpty/': null,
      'notEmpty/file.txt': 'data',
    });
    const deleted = await deleteEmptyFolders(new URL(base), false);
    assert(deleted.includes(base + 'empty1/'), 'empty1/ should be in deleted list');
    assert(deleted.includes(base + 'empty2/'), 'empty2/ should be in deleted list');
    assert(!deleted.includes(base + 'notEmpty/'), 'notEmpty/ should not be in deleted list');
    assert(!deleted.includes(base), 'base/ should not be in deleted list');
  });
});
