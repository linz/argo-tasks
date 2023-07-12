import { fsa } from '@chunkd/fs';
import { basename } from 'path';
import { registerCli } from '../commands/common.js';
import { s3Fs } from '../fs.register.js';
import { logger } from '../log.js';
import { ConcurrentQueue } from '../utils/concurrent.queue.js';

const SourceLocation = 's3://linz-topographic-upload/blacha/SNC9990';
const TargetLocation = 's3://linz-basemaps-source/target-location';

s3Fs.credentials.register({
  prefix: SourceLocation,
  roleArn: `arn:aws:iam::019359803926:role/internal-user-read`,
  flags: 'r',
});
s3Fs.credentials.register({
  prefix: TargetLocation,
  roleArn: `arn:aws:iam::019359803926:role/internal-user-read`,
  flags: 'rw',
});

const q = new ConcurrentQueue(25);

async function main(): Promise<void> {
  await registerCli({ name: 'direct' }, { verbose: true });

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
