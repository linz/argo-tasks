import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';

import {
  fetchPendingRestoredObjectPaths,
  fetchResultKeysFromReport,
  isRestoreCompleted,
  parseReportResult,
} from '../verify.restore.ts';

describe('fetchResultKeysFromReport', () => {
  it('returns keys for succeeded results', async () => {
    const report = {
      Results: [
        { TaskExecutionStatus: 'succeeded', Bucket: 'b', Key: 'k', MD5Checksum: 'm' },
        { TaskExecutionStatus: 'succeeded', Bucket: 'b2', Key: 'k2', MD5Checksum: 'm2' },
      ],
    };
    const keys = fetchResultKeysFromReport(report);
    assert.deepEqual(keys, ['s3://b/k', 's3://b2/k2']);
  });

  it('throws if any result is not succeeded', async () => {
    const report = {
      Results: [
        { TaskExecutionStatus: 'succeeded', Bucket: 'b', Key: 'k', MD5Checksum: 'm' },
        { TaskExecutionStatus: 'failed', Bucket: 'b', Key: 'k', MD5Checksum: 'm' },
        { TaskExecutionStatus: 'succeeded', Bucket: 'b2', Key: 'k2', MD5Checksum: 'm2' },
      ],
    };
    assert.throws(() => fetchResultKeysFromReport(report), { message: /not succeeded/ });
  });
});

describe('fetchPendingRestoredObjectPaths', () => {
  it('returns Bucket/Key for successful requests', async () => {
    const entries = [
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: '',
        TaskStatus: '',
        ErrorCode: '',
        HTTPStatusCode: '',
        ResultMessage: 'Successful',
      },
    ];
    const files = fetchPendingRestoredObjectPaths(entries);
    assert.deepEqual(files, [{ Bucket: 'b', Key: 'k' }]);
  });

  it('throws if any request is not successful', async () => {
    const entries = [
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: '',
        TaskStatus: '',
        ErrorCode: '',
        HTTPStatusCode: '',
        ResultMessage: 'Successful',
      },
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: '',
        TaskStatus: '',
        ErrorCode: '',
        HTTPStatusCode: '',
        ResultMessage: 'Failed',
      },
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: '',
        TaskStatus: '',
        ErrorCode: '',
        HTTPStatusCode: '',
        ResultMessage: 'Successful',
      },
    ];
    assert.throws(() => fetchPendingRestoredObjectPaths(entries), { message: /not successful/ });
  });
});

describe('parseReportResult', () => {
  it('parses CSV string into ReportResult[]', () => {
    const csv = 'b,k,v,ts,ec,hs,Successful\nb2,k2,v2,ts2,ec2,hs2,Failed';
    const results = parseReportResult(csv);
    assert.deepEqual(results, [
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: 'v',
        TaskStatus: 'ts',
        ErrorCode: 'ec',
        HTTPStatusCode: 'hs',
        ResultMessage: 'Successful',
      },
      {
        Bucket: 'b2',
        Key: 'k2',
        VersionId: 'v2',
        TaskStatus: 'ts2',
        ErrorCode: 'ec2',
        HTTPStatusCode: 'hs2',
        ResultMessage: 'Failed',
      },
    ]);
  });
});

describe('isRestoreCompleted', () => {
  it('returns true if Restore is ongoing-request="false"', async () => {
    const headObjectOutput: HeadObjectCommandOutput = {
      Restore: 'ongoing-request="false"',
      $metadata: { httpStatusCode: 200, requestId: '', extendedRequestId: '', cfId: '' },
    };
    assert.strictEqual(isRestoreCompleted(headObjectOutput), true);
  });

  it('returns false if Restore is ongoing-request="true"', async () => {
    const headObjectOutput: HeadObjectCommandOutput = {
      Restore: 'ongoing-request="true"',
      $metadata: { httpStatusCode: 200, requestId: '', extendedRequestId: '', cfId: '' },
    };
    assert.strictEqual(isRestoreCompleted(headObjectOutput), false);
  });

  it('throws if Restore is undefined', async () => {
    const headObjectOutput: HeadObjectCommandOutput = {
      $metadata: { httpStatusCode: 200, requestId: '', extendedRequestId: '', cfId: '' },
    };
    assert.throws(() => isRestoreCompleted(headObjectOutput), /undefined/);
  });
});
