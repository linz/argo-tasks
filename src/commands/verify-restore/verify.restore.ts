import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { fsa } from '@chunkd/fs';
import { boolean, command, flag, option, positional } from 'cmd-ts';
import pLimit from 'p-limit';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, replaceUrlExtension, S3Path, UrlFolder, verbose } from '../common.ts';

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
    markDone: flag({
      type: boolean,
      defaultValue: () => true,
      long: 'mark-done',
      description:
        'Rename the restore report file to `*.done` if restore is successful to indicate it has been processed',
    }),
    output: option({ type: UrlFolder, long: 'output', description: 'Output location to store the restore result' }),
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
      logger.info({ path: args.report.toString() }, 'VerifyRestore:LoadReport');
      const report: ManifestReport = await fsa.readJson(args.report);
      resultKeys = fetchResultKeysFromReport(report);
    } catch (error) {
      logger.error({ error, path: args.report.toString() }, 'VerifyRestore:FailedToLoadReport');
      throw error;
    }
    /* 
    Each report manifest links to multiple CSV files or "sub manifests"
      that contains the list of files that were triggered for restoration.
    */
    let anyNotRestored = false;
    for (const key of resultKeys) {
      logger.info({ key }, 'VerifyRestore:ProcessingCSVResult');
      const resultPath = new URL(key, args.report);
      const reportResult = await fsa.read(resultPath);
      const resultEntries: ReportResult[] = parseReportResult(reportResult.toString());
      const files = fetchPendingRestoredObjectPaths(resultEntries);

      const limit = pLimit(10);
      const restoreChecks = files.map((file) =>
        limit(async () => {
          logger.info({ path: file }, 'VerifyRestore:CheckingFile');
          const headObjectOutput = await headS3Object(file);
          let restoreCompleted = false;
          try {
            restoreCompleted = isRestoreCompleted(headObjectOutput);
          } catch (error: unknown) {
            logger.error({ path: file, error }, 'VerifyRestore:FailedToCheckRestoreStatus');
            throw new Error(`Failed to check restore status for s3://${file.Bucket}/${file.Key}: ${String(error)}`);
          }
          if (!restoreCompleted) {
            anyNotRestored = true;
            logger.info({ path: file }, 'VerifyRestore:NotRestored');
            return;
          }
          logger.info({ file }, 'VerifyRestore:Restored');
        }),
      );
      await Promise.all(restoreChecks);
    }

    if (anyNotRestored) {
      await fsa.write(args.output, Buffer.from('false'));
    } else {
      await fsa.write(args.output, Buffer.from('true'));
      if (args.markDone) {
        await markReportDone(args.report);
      }
    }

    logger.info('VerifyRestore:Done');
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

  return Results.map((r) => new URL(`s3://${r.Bucket}/${r.Key}`));
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
async function headS3Object(path: { Bucket: string; Key: string }): Promise<HeadObjectCommandOutput> {
  const objectKey = decodeFormUrlEncoded(path.Key);
  const objectPath = `s3://${path.Bucket}/${objectKey}`;
  logger.info({ path: objectPath }, 'VerifyRestore:HeadObject:Start');
  try {
    const headObjectOutput: HeadObjectCommandOutput = await (fsa.get(new URL(objectPath), 'r') as FsAwsS3V3).client.send(
      new HeadObjectCommand({ Bucket: path.Bucket, Key: objectKey }),
    );
    logger.info({ path: objectPath, headObjectOutput }, 'VerifyRestore:HeadObject:Done');
    return headObjectOutput;
  } catch (error) {
    logger.error({ path: objectPath, error }, 'VerifyRestore:HeadObject:Failed');
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
export function isRestoreCompleted(headObjectOutput: HeadObjectCommandOutput): boolean {
  if (headObjectOutput?.Restore === undefined) {
    logger.error({ headObjectOutput }, 'VerifyRestore:RestoreStatusUndefined');
    throw new Error('Restore status is undefined.');
  }
  logger.info({ restoreStatus: headObjectOutput.Restore }, 'VerifyRestore:RestoreStatus');
  return headObjectOutput.Restore === 'ongoing-request="false"';
}

/**
 * Renames the report file adding a `.done` suffix to indicate it has been processed.
 * This is useful to avoid reprocessing the same report file.
 *
 * @param reportPath - The path to the report file.
 */
async function markReportDone(reportPath: URL): Promise<void> {
  const donePath = replaceUrlExtension(reportPath, new RegExp('$'), '.done');
  await fsa.write(donePath, await fsa.read(reportPath));
  await fsa.delete(reportPath);
  logger.info({ reportPath, donePath }, 'VerifyRestore:MarkedReportDone');
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
