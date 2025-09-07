import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { deleteEmptyFolders, isFolder } from '../delete.empty.folders.ts';

/**
 * Create a directory tree in memory
 *
 * @param base The base path for the tree
 * @param structure The structure of the tree
 */
async function createTree(base: URL, structure: Record<string, string | null>): Promise<void> {
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = new URL(path, base);
    if (content === null) {
      await fsa.write(fullPath, '');
    } else {
      await fsa.write(fullPath, content);
    }
  }
}

const memFs = new FsMemory();
const base = fsa.toUrl('memory://base/');

beforeEach(async () => {
  fsa.systems.length = 0;
  fsa.register('memory://', memFs);
  memFs.files.clear();
  await fsa.write(base, '');
});

describe('isFolder', () => {
  it('should return true for an empty folder (0 bytes, trailing slash)', async () => {
    const folder = new URL('empty/', base);
    await fsa.write(folder, '');
    const result = await isFolder(folder);
    assert.strictEqual(result, true);
  });

  it('should return false for a file (no trailing slash)', async () => {
    const file = new URL('file.txt', base);
    await fsa.write(file, 'data');
    const result = await isFolder(file);
    assert.strictEqual(result, false);
  });

  it('should return false for a folder with non-zero size', async () => {
    const folder = new URL('notEmpty/', base);
    await fsa.write(folder, 'data');
    const result = await isFolder(folder);
    assert.strictEqual(result, false);
  });

  it('should return false for a string without trailing slash', async () => {
    const folder = new URL('noSlash', base);
    await fsa.write(folder, '');
    const result = await isFolder(folder);
    assert.strictEqual(result, false);
  });

  it('should return false for a non-existent path', async () => {
    const folder = new URL('doesnotexist/', base);
    const result = await isFolder(folder);
    assert.strictEqual(result, false);
  });
});

describe('deleteEmptyFolders', () => {
  it('should delete empty folders recursively', async () => {
    await createTree(base, {
      'a/': null,
      'a/b/': null,
      'a/b/c/': null,
      'a/b/file.txt': 'data',
      'd/': null,
      'e/': null,
    });
    await deleteEmptyFolders(base, false);
    assert(!(await fsa.exists(new URL('a/b/c/', base))), 'a/b/c/ should be deleted');
    assert(await fsa.exists(new URL('a/b/', base)), 'a/b/ should still exist (not empty)');
  });

  it('should not delete non-empty folders', async () => {
    await createTree(base, {
      'x/': null,
      'x/file.txt': 'data',
    });
    await deleteEmptyFolders(base, false);
    assert(await fsa.exists(new URL('x/', base)), 'x/ should not be deleted');
  });

  it('should not delete files with trailing slashes', async () => {
    await createTree(base, {
      'x/': 'data',
    });
    await deleteEmptyFolders(base, false);
    assert(await fsa.exists(new URL('x/', base)), 'x/ should not be deleted');
  });

  it('should delete the base folder', async () => {
    await createTree(base, {
      'x/': null,
    });
    await deleteEmptyFolders(base, false);
    assert(!(await fsa.exists(base)), 'base/ should be deleted');
  });

  it('should do nothing in dryRun mode (default)', async () => {
    await createTree(base, {
      'y/': null,
    });
    await deleteEmptyFolders(base);
    assert(await fsa.exists(new URL('y/', base)), 'y/ should not be deleted in dryRun');
  });

  it('should return the list of deleted folders', async () => {
    await createTree(base, {
      'empty1/': null,
      'empty2/': null,
      'notEmpty/': null,
      'notEmpty/file.txt': 'data',
    });
    const deleted = await deleteEmptyFolders(base, false);
    const deletedNames = deleted.map((loc) => loc.href);
    assert(deletedNames.includes(new URL('empty1/', base).href), 'empty1/ should be in deleted list');
    assert(deletedNames.includes(new URL('empty2/', base).href), 'empty2/ should be in deleted list');
    assert(!deletedNames.includes(new URL('notEmpty/', base).href), 'notEmpty/ should not be in deleted list');
    assert(!deletedNames.includes(base.href), 'base/ should not be in deleted list');
  });
});
