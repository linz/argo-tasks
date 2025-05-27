import assert from 'node:assert';
import { describe, it } from 'node:test';

import { getArchiveBucketName, getArchiveLocation } from '../archive.setup.ts';
import { isSafePath } from '../archive.setup.ts';

describe('getArchiveBucketName', () => {
  it('should return the correct archive bucket name for a valid source bucket', () => {
    const expectedBucketName = 'linz-topographic-archive';
    const result = getArchiveBucketName('linz-topographic-upload');
    assert.equal(result, expectedBucketName);
  });

  it('should throw an error for an unsupported source bucket', () => {
    assert.throws(
      () => {
        getArchiveBucketName('unsupported-bucket');
      },
      {
        message: 'Source bucket unsupported-bucket is not supported for archiving',
      },
    );
  });

  it('should return the archive bucket for the hydro-data-bucket-[account-id]', () => {
    const expectedBucketName = 'linz-hydrographic-archive';
    const result = getArchiveBucketName('hydro-data-bucket-123456789012');
    assert.equal(result, expectedBucketName);
  });

  describe('isSafePath', () => {
    it('should return true for a path with sufficient depth', () => {
      const path = new URL('s3://upload/folder1/folder2/file.txt');
      const result = isSafePath(path, 2);
      assert.equal(result, true);
    });

    it('should return false for a path with insufficient depth', () => {
      const path = new URL('s3://upload/folder1/file.txt');
      const result = isSafePath(path, 3);
      assert.equal(result, false);
    });

    it('should return true for a path with exactly the minimum depth', () => {
      const path = new URL('s3://upload/folder1/folder2/');
      const result = isSafePath(path, 2);
      assert.equal(result, true);
    });

    it('should return false for a path with no directories', () => {
      const path = new URL('s3://upload/');
      const result = isSafePath(path, 1);
      assert.equal(result, false);
    });
  });

  describe('getArchiveLocation', () => {
    it('should return the archive location given a source bucket and archive bucket name', () => {
      const archiveLocation = getArchiveLocation('s3://upload/folder1/folder2/', 'archive-bucket');
      assert.equal(archiveLocation, 's3://archive-bucket/folder1/folder2/');
    });
  });
});
