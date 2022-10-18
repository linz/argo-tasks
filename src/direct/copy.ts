import { fsa } from '@chunkd/fs';
import { AwsCredentials } from '@chunkd/source-aws-v2';
import { basename } from 'path';
import { registerCli } from '../commands/common';
import { logger } from '../log';
import { ConcurrentQueue } from '../utils/concurrent.queue';

const SourceLocation = 's3://linz-imagery-source/source-location';
const TargetLocation = 's3://linz-imagery-target/target-location';

// If the target or source bucket is not inside the same account a role assumption can be used
const SourceAccountRole = `arn:aws:iam::1234567890:role/internal-user-read`;
const TargetAccountRole = `arn:aws:iam::1234567890:role/internal-user-read-write`;
fsa.register(SourceLocation, AwsCredentials.fsFromRole(SourceAccountRole));
fsa.register(TargetLocation, AwsCredentials.fsFromRole(TargetAccountRole));

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
