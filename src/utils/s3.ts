import { S3 } from '@aws-sdk/client-s3';

export async function getS3ObjectAsJson<T>(bucket: string, collectionPath: string, s3: S3): Promise<T> {
  return JSON.parse(
    await s3
      .getObject({
        Bucket: bucket,
        Key: collectionPath,
      })
      .then((value) => value.Body!.toString()),
  ) as T;
}

export function s3Client(): S3 {
  return new S3([{ maxAttempts: 3 }]);
}
