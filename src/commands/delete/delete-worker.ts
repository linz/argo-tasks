import { parentPort, threadId } from 'node:worker_threads';

import { fsa } from '@chunkd/fs';
import { WorkerRpc } from '@wtrpc/core';

import { logger } from '../../log.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { registerCli } from '../common.ts';
import type { DeleteContract, DeleteContractArgs, DeleteStats } from './delete-rpc.ts';

const Q = new ConcurrentQueue(10);

/** Current log id */
let currentId: string | null = null;

export const worker = new WorkerRpc<DeleteContract>({
  async delete(args: DeleteContractArgs): Promise<DeleteStats> {
    const stats: DeleteStats = { deleted: 0, skipped: 0 };
    const end = Math.min(args.start + args.size, args.manifest.length);

    if (currentId == null) {
      logger.setBindings({ correlationId: args.id, threadId });
      currentId = args.id;
    }

    for (let i = args.start; i < end; i++) {
      const todo = args.manifest[i];
      if (todo == null) continue;

      Q.push(async () => {
        try {
          const exists = await fsa.head(todo.source);
          if (exists == null || exists.size == null) {
            logger.info({ path: todo.source }, 'File:Delete:SkippedNotFound');
            stats.skipped++;
            return;
          }

          if (args.dryRun) {
            logger.info({ path: todo.source }, 'File:Delete:SkippedDryRun');
            stats.skipped++;
            return;
          }

          await fsa.delete(todo.source);
          logger.info({ path: todo.source }, 'File:Delete:Done');
          stats.deleted++;
        } catch (err) {
          logger.fatal({ path: todo.source, err }, 'File:Delete:Failed');
        }
      });
    }

    await Q.join().catch((err: unknown) => {
      logger.fatal({ err }, 'File:Delete:Failed');
      throw err;
    });

    return stats;
  },
});

worker.onStart = (): Promise<void> => {
  registerCli({ name: 'delete:worker' }, {});
  return Promise.resolve();
};

if (parentPort) worker.bind(parentPort);
