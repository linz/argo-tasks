import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import type { FileInfo } from '@chunkd/fs';
import { fsa } from '@chunkd/fs';
import { command, option, positional } from 'cmd-ts';
import pLimit from 'p-limit';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import { config, registerCli, S3Path, Url, verbose } from '../common.ts';

/** Represents the manifest report structure for S3 Batch Operations Restore. */
export type ManifestReport = {
  Results: ManifestReportResult[];
};

/** Represents a single result in the manifest report. */
export type ManifestReportResult = {
  TaskExecutionStatus: string;
  Bucket: string;
  MD5Checksum: string;
  Key: string;
};

/** Represents a single result (CSV file) in the report. */
type ReportResult = {
  Bucket: string;
  Key: string;
  VersionId: string;
  TaskStatus: string;
  ErrorCode: string;
  HTTPStatusCode: string;
  ResultMessage: string;
};

export const commandVerifyRestore = command({
  name: 'verify-restore',
  description:
    'Verify that all the files requested to be restored with S3 Batch Operations Restore are restored yet. Output a boolean value to indicate if all files are restored.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    output: option({ type: Url, long: 'output', description: 'Output location to store the restore result' }),
    report: positional({
      type: S3Path,
      displayName: 'report',
      description: 'Path to the S3 Batch Operation Restore report file',
    }),
  },
  async handler(args) {
    registerCli(this, args);
    logger.info('VerifyRestore:Start');

    let resultKeys: URL[] = [];
    try {
      logger.info({ path: protocolAwareString(args.report) }, 'VerifyRestore:LoadReport');
      const report: ManifestReport = await fsa.readJson(args.report);
      resultKeys = fetchResultKeysFromReport(report);
    } catch (error) {
      logger.error({ error, path: protocolAwareString(args.report) }, 'VerifyRestore:FailedToLoadReport');
      throw error;
    }
    /* 
    Each report manifest links to multiple CSV files or "sub manifests"
      that contains the list of files that were triggered for restoration.
    */
    let isAllRestored = true;
    for (const key of resultKeys) {
      logger.info({ key: protocolAwareString(key) }, 'VerifyRestore:ProcessingCSVResult');
      const resultPath = new URL(key, args.report);
      const reportResult = await fsa.read(resultPath);
      const resultEntries: ReportResult[] = parseReportResult(reportResult.toString());
      const files = fetchPendingRestoredObjectPaths(resultEntries);

      const limit = pLimit(10);
      const restoreChecks = files.map((file) =>
        limit(async () => {
          logger.info({ path: file }, 'VerifyRestore:CheckingFile');
          const headObjectOutput = await headS3Object(file);
          let isObjectRestored = false;
          try {
            isObjectRestored = isRestoreCompleted(headObjectOutput);
          } catch (error: unknown) {
            logger.error({ path: file, error }, 'VerifyRestore:FailedToCheckRestoreStatus');
            throw new Error(`Failed to check restore status for s3://${file.Bucket}/${file.Key}: ${String(error)}`);
          }
          if (!isObjectRestored) {
            isAllRestored = false;
            logger.info({ path: file }, 'VerifyRestore:NotRestored');
            return;
          }
          logger.info({ file }, 'VerifyRestore:Restored');
        }),
      );
      await Promise.all(restoreChecks);
    }

    await fsa.write(args.output, Buffer.from(isAllRestored.toString()));

    logger.info({ restored: isAllRestored }, 'VerifyRestore:Done');
  },
});

/**
 * Fetches the result keys from the manifest report.
 * Throws an error if any of the results did not succeed.
 *
 * @param report - The manifest report containing results.
 * @returns An array of S3 paths for the restored files.
 */
export function fetchResultKeysFromReport(report: ManifestReport): URL[] {
  const { Results } = report;
  const notSucceeded = Results.filter((r) => r.TaskExecutionStatus?.toLowerCase() !== 'succeeded');
  if (notSucceeded.length) {
    throw new Error(
      `Some report results have not succeeded: ${notSucceeded.map((r) => `s3://${r.Bucket}/${r.Key}`).join(', ')}`,
    );
  }

  return Results.map((r) => fsa.toUrl(`s3://${r.Bucket}/${r.Key}`));
}

/** Fetches the paths of pending restored objects from the report results.
 * Throws an error if any restore requests are not successful.
 *
 * @param resultEntries - The report results containing object paths and statuses.
 * @returns An array of objects containing the Bucket and Key of each restored object.
 */
export function fetchPendingRestoredObjectPaths(resultEntries: ReportResult[]): { Bucket: string; Key: string }[] {
  const notSuccessfulRequests = resultEntries.filter((row: ReportResult) => row.ResultMessage.trim() !== 'Successful');
  if (notSuccessfulRequests.length) {
    throw new Error(
      `Some restore requests are not successful: ${notSuccessfulRequests.map((row) => row.Key).join(', ')}`,
    );
  }

  return resultEntries.map((row) => ({
    Bucket: row.Bucket,
    Key: row.Key,
  }));
}

/**
 * Parses the CSV report result string into an array of ReportResult.
 *
 * FIXME: The ReportSchema provided by AWS
 * ("ReportSchema": "Bucket, Key, VersionId, TaskStatus, ErrorCode, HTTPStatusCode, ResultMessage")
 * is wrong and the actual CSV format is:
 * "ReportSchema": "Bucket, Key, VersionId, TaskStatus, HTTPStatusCode, ErrorCode, ResultMessage"
 *
 * @param result - The CSV result string containing restored object paths and statuses.
 * @returns An array of ReportResult.
 */
export function parseReportResult(result: string): ReportResult[] {
  const lines = result.trim().split('\n');

  return lines.map((line) => {
    const parts = line.split(',');
    return {
      Bucket: parts[0] ?? '',
      Key: parts[1] ?? '',
      VersionId: parts[2] ?? '',
      TaskStatus: parts[3] ?? '',
      HTTPStatusCode: parts[4] ?? '',
      ErrorCode: parts[5] ?? '',
      ResultMessage: parts[6] ?? '',
    };
  });
}

/**
 * Heads an S3 object.
 *
 * @param path - The S3 path to the object to get info from.
 * @throws Will throw an error if the headObject request fails.
 * @returns The head object output.
 */
async function headS3Object(path: { Bucket: string; Key: string }): Promise<FileInfo<HeadObjectCommandOutput>> {
  const objectKey = decodeFormUrlEncoded(path.Key);
  const objectPath = `s3://${path.Bucket}/${objectKey}`;
  logger.info({ path: objectPath }, 'VerifyRestore:HeadS3Object:Start');
  try {
    const fileInfo = (await fsa.head(fsa.toUrl(objectPath))) as FileInfo<HeadObjectCommandOutput>;
    if (!fileInfo) {
      throw new Error('No info returned when trying to head the object');
    }
    logger.info({ path: objectPath, fileInfo }, 'VerifyRestore:HeadS3Object:Done');
    return fileInfo;
  } catch (error) {
    logger.error({ path: objectPath, error }, 'VerifyRestore:HeadS3Object:Failed');
    throw new Error(`Failed to headObject() for ${objectPath}: ${String(error)}`);
  }
}
/**
 * Checks if the restore is completed by examining the Restore field in the headObject output.
 * If the Restore field is 'ongoing-request="false"', it means the restore is completed.
 *
 * @throws Will throw an error if the restore status is undefined.
 * @returns A boolean indicating whether the restore is completed.
 */
export function isRestoreCompleted(fileInfo: FileInfo<HeadObjectCommandOutput>): boolean {
  logger.info('VerifyRestore:CheckingRestoreStatus');
  const restoreStatus = fileInfo.$response?.Restore;
  if (restoreStatus === undefined) {
    logger.error({ headObjectOutput: fileInfo }, 'VerifyRestore:RestoreStatusUndefined');
    throw new Error('Restore status is undefined.');
  }
  logger.info({ restoreStatus }, 'VerifyRestore:RestoreStatus');
  return restoreStatus.includes('ongoing-request="false"');
}

/**
 * Decodes a URL-encoded string.
 *
 * @param key - The URL-encoded string to decode.
 * @returns The decoded string.
 */
export function decodeFormUrlEncoded(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, ' '));
}
