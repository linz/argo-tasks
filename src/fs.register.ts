import { setTimeout } from "node:timers/promises.ts";

import { S3Client } from '@aws-sdk/client-s3';
import { fsa } from '@chunkd/fs';
import { FsAwsS3 } from '@chunkd/source-aws';
import { FsAwsS3V3, S3LikeV3 } from '@chunkd/source-aws-v3';
import { BuildMiddleware, FinalizeRequestMiddleware, MetadataBearer } from '@smithy/types';

import { logger } from "./log.ts";

/** Check to see if hostname exists inside of a object */
function hasHostName(x: unknown): x is { hostname: string } {
  if (x == null) return false;
  if (typeof x === 'object' && 'hostname' in x && typeof x.hostname === 'string') return true;
  return false;
}

/**
 * AWS SDK middleware function to force fully qualified domain name  on s3 requests
 *
 * AWS S3 inside of kubernetes triggers a lot of DNS requests
 * by forcing a fully qualified domain name lookup (trailing ".")
 * it greatly reduces the number of DNS requests we make
 */
export const fqdn: FinalizeRequestMiddleware<object, MetadataBearer> = (next) => {
  return (args) => {
    if (hasHostName(args.request) && args.request.hostname.endsWith('.s3.ap-southeast-2.amazonaws.com')) {
      args.request.hostname += '.';
    }
    return next(args);
  };
};

/**
 * AWS SDK middleware logic to try 3 times if receiving an EAI_AGAIN error
 */
export function eaiAgainBuilder(timeout: (attempt: number) => number): BuildMiddleware<object, MetadataBearer> {
  const eaiAgain: BuildMiddleware<object, MetadataBearer> = (next) => {
    const maxTries = 3;
    let totalDelay = 0;
    return async (args) => {
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
          return await next(args);
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && 'hostname' in error) {
            if (error.code !== 'EAI_AGAIN') {
              throw error;
            }
            const delay = timeout(attempt);
            totalDelay += delay;
            logger.warn({ host: error.hostname, attempt, delay, totalDelay }, `eai_again:retry`);
            await setTimeout(timeout(attempt));
          } else {
            throw error;
          }
        }
      }
      throw new Error(`EAI_AGAIN maximum tries (${maxTries}) exceeded`);
    };
  };
  return eaiAgain;
}

/**
 * When a new AWS file system is created copy across the middleware, but only if the middleware does not exist
 *
 * @param fsClient Filesystem to setup
 */
export function setupS3FileSystem(fsClient: FsAwsS3V3): void {
  addMiddlewareToS3Client(fsClient.client);

  if (fsClient.credentials == null) return;
  const oldFind = fsClient.credentials.find.bind(fsClient.credentials);
  // When file systems are looked up ensure they are registered into `fsa`
  fsClient.credentials.find = async (path: string): Promise<FsAwsS3 | null> => {
    const accountConfig = await fsClient.credentials.findCredentials(path);
    if (accountConfig == null) return null;

    const fileSystem = await oldFind(path);
    if (fileSystem == null) return null;

    logger.debug({ prefix: path, roleArn: accountConfig.roleArn }, 'FileSystem:Register');
    fsa.register(accountConfig.prefix, fileSystem);
    if (fileSystem.s3 != null && 'client' in fileSystem.s3) {
      addMiddlewareToS3Client((fileSystem.s3 as S3LikeV3).client);
    }
    return fileSystem;
  };
}

/**
 * ensure the FQDN and EAI_AGAIN Middleware exist on a s3 client
 *
 * @param client
 */
export function addMiddlewareToS3Client(client: S3Client): void {
  // There doesnt appear to be a has or find, so the only option is to list all middleware
  // which returns a list in a format: "FQDN - finalizeRequest"
  const middleware = client.middlewareStack.identify();

  if (middleware.find((f) => f.startsWith('FQDN ')) == null) {
    client.middlewareStack.add(fqdn, { name: 'FQDN', step: 'finalizeRequest' });
  }

  if (middleware.find((f) => f.startsWith('EAI_AGAIN ')) == null) {
    client.middlewareStack.add(
      eaiAgainBuilder((attempt: number) => 100 + attempt * 1000),
      { name: 'EAI_AGAIN', step: 'build' },
    );
  }
}

FsAwsS3.MaxListCount = 1000;

function splitConfig(x: string): string[] {
  if (x.startsWith('[')) return JSON.parse(x) as string[];
  return x.split(',');
}

export function registerFileSystem(opts: { config?: string }): FsAwsS3V3 {
  const s3Fs = new FsAwsS3V3(new S3Client());
  setupS3FileSystem(s3Fs);

  fsa.register('s3://', s3Fs);

  const configPath = opts.config ?? process.env['AWS_ROLE_CONFIG_PATH'];
  if (configPath == null || configPath === '') return s3Fs;

  const paths = splitConfig(configPath);

  for (const path of paths) s3Fs.credentials.registerConfig(path, fsa);

  return s3Fs;
}
