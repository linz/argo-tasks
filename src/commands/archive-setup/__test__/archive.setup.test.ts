import assert from 'node:assert';
import { describe, it } from 'node:test';

import { getArchiveBucketName } from '../archive.setup.ts';

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
});
