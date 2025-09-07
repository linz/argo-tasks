import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import type { FileInfo } from '@chunkd/fs';
import { fsa, FsMemory } from '@chunkd/fs';

import {
  decodeFormUrlEncoded,
  fetchPendingRestoredObjectPaths,
  fetchResultKeysFromReport,
  isRestoreCompleted,
  markReportDone,
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
    assert.deepEqual(keys, [fsa.toUrl('s3://b/k'), fsa.toUrl('s3://b2/k2')]);
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

  it('treats ResultMessage with trailing \\r as successful', () => {
    const entries = [
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: '',
        TaskStatus: '',
        ErrorCode: '',
        HTTPStatusCode: '',
        ResultMessage: 'Successful\r',
      },
    ];
    assert.deepStrictEqual(fetchPendingRestoredObjectPaths(entries), [{ Bucket: 'b', Key: 'k' }]);
  });
});

describe('parseReportResult', () => {
  it('parses CSV string into ReportResult[]', () => {
    const csv = 'b,k,v,ts,hs,ec,Successful\nb2,k2,v2,ts2,hs2,ec2,Failed';
    const results = parseReportResult(csv);
    assert.deepStrictEqual(results, [
      {
        Bucket: 'b',
        Key: 'k',
        VersionId: 'v',
        TaskStatus: 'ts',
        HTTPStatusCode: 'hs',
        ErrorCode: 'ec',
        ResultMessage: 'Successful',
      },
      {
        Bucket: 'b2',
        Key: 'k2',
        VersionId: 'v2',
        TaskStatus: 'ts2',
        HTTPStatusCode: 'hs2',
        ErrorCode: 'ec2',
        ResultMessage: 'Failed',
      },
    ]);
  });
});

describe('isRestoreCompleted', () => {
  it('returns true if Restore is ongoing-request="false"', async () => {
    const headObjectOutput: HeadObjectCommandOutput = {
      Restore: 'ongoing-request="false", expiry-date="Sat, 16 Aug 2025 00:00:00 GMT"',
      $metadata: { httpStatusCode: 200, requestId: '', extendedRequestId: '', cfId: '' },
    };
    const fileInfo: FileInfo<HeadObjectCommandOutput> = {
      url: fsa.toUrl('s3://bucket/key'), // not used in isRestoreCompleted
      $response: headObjectOutput,
    };
    assert.strictEqual(isRestoreCompleted(fileInfo), true);
  });

  it('returns false if Restore is ongoing-request="true"', async () => {
    const headObjectOutput: HeadObjectCommandOutput = {
      Restore: 'ongoing-request="true"',
      $metadata: { httpStatusCode: 200, requestId: '', extendedRequestId: '', cfId: '' },
    };
    const fileInfo: FileInfo<HeadObjectCommandOutput> = {
      url: fsa.toUrl('s3://bucket/key'), // not used in isRestoreCompleted
      $response: headObjectOutput,
    };
    assert.strictEqual(isRestoreCompleted(fileInfo), false);
  });

  it('throws if Restore is undefined', async () => {
    const headObjectOutput: HeadObjectCommandOutput = {
      $metadata: { httpStatusCode: 200, requestId: '', extendedRequestId: '', cfId: '' },
    };
    const fileInfo: FileInfo<HeadObjectCommandOutput> = {
      url: fsa.toUrl('s3://bucket/key'), // not used in isRestoreCompleted
      ...headObjectOutput,
    };
    assert.throws(() => isRestoreCompleted(fileInfo), /undefined/);
  });
});

describe('decodeFormUrlEncoded', () => {
  it('should decode a standard URL-encoded string', () => {
    assert.strictEqual(decodeFormUrlEncoded('hello%20world'), 'hello world');
  });

  it('should decode plus signs as spaces', () => {
    assert.strictEqual(decodeFormUrlEncoded('hello+world'), 'hello world');
  });

  it('should decode mixed encoding', () => {
    assert.strictEqual(decodeFormUrlEncoded('file%2Bname+with+spaces%21'), 'file+name with spaces!');
  });

  it('should return the same string if no encoding is present', () => {
    assert.strictEqual(decodeFormUrlEncoded('plainstring'), 'plainstring');
  });

  it('should decode complex encoded strings', () => {
    assert.strictEqual(
      decodeFormUrlEncoded('%2Fpath%2Fto%2Bfile+with+spaces%2Band%2Bplus'),
      '/path/to+file with spaces+and+plus',
    );
  });
});

describe('markReportDone', () => {
  const memory = new FsMemory();
  fsa.register('memory://', memory);
  memory.files.clear();

  it('should rename the report file by adding a .done suffix', async () => {
    const reportfile = fsa.toUrl('memory://fake/report.csv');
    await fsa.write(reportfile, 'report content');
    await markReportDone(reportfile);
    const doneFile = fsa.toUrl('memory://fake/report.csv.done');
    const doneContent = (await fsa.read(doneFile)).toString();
    assert.strictEqual(doneContent, 'report content');
    const exists = await fsa.exists(reportfile);
    assert.strictEqual(exists, false);
  });
});
