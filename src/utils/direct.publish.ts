import { fsa } from '@chunkd/fs';
import { AwsCredentials } from '@chunkd/source-aws-v2';
import { basename } from 'path';
import { registerCli } from '../commands/common';
import { logger } from '../log';
import { ConcurrentQueue } from './concurrent.queue';

// 2022-10-18T00:27:45.508Z
const SourceLocation = 's3://linz-workflow-artifacts/...../flat';
const TargetLocation = 's3://linz-imagery/manawatu-whanganui/manawatu-whanganui_2021-2022_0.3m/rgb/2193/';

fsa.register('s3://linz-imagery', AwsCredentials.fsFromRole('arn:aws:iam::948908489518:role/internal-user-read-write'));

const q = new ConcurrentQueue(25);

async function main(): Promise<void> {
  await registerCli({ verbose: true });

  for await (const source of fsa.details(SourceLocation)) {
    if (source.size === 0) continue;
    const target = fsa.join(TargetLocation, basename(source.path));

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
