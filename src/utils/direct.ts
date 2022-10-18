import { fsa } from '@chunkd/fs';
import { AwsCredentials } from '@chunkd/source-aws-v2';
import { basename } from 'path';
import { registerCli } from '../commands/common';
import { logger } from '../log';
import { ConcurrentQueue } from './concurrent.queue';

const SourceLocation = 's3://linz-imagery-upload/source-location';
const TargetLocation = 's3://linz-imagery-upload/target-location';

const AccountId = 123456;
fsa.register('s3://linz-imagery', AwsCredentials.fsFromRole(`arn:aws:iam::${AccountId}:role/internal-user-read-write`));

const q = new ConcurrentQueue(25);

async function main(): Promise<void> {
  await registerCli({ verbose: true });

  for await (const source of fsa.details(SourceLocation)) {
    if (source.size === 0) continue;
    const sourceFileName = basename(source.path);
    const target = fsa.join(TargetLocation, sourceFileName);

    q.push(async () => {
      const exists = await fsa.exists(target);
      if (exists) {
        logger.warn({ source: source.path, target }, 'File:Skipped');
        return;
      }

      await fsa.write(target, fsa.stream(source.path));
      logger.info({ source: source.path, target }, 'File:Copied');
    });
  }
  await q.join();
}

main();
