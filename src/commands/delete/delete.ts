import { fsa } from '@chunkd/fs';
import { WorkerRpcPool } from '@wtrpc/core';
import { boolean, command, flag, number, option, restPositionals, string } from 'cmd-ts';
import { performance } from 'perf_hooks';
import { z } from 'zod';

import { CliInfo } from '../../cli.info.ts';
import { logger, logId } from '../../log.ts';
import type { ActionCopy } from '../../utils/actions.ts';
import { config, registerCli, verbose } from '../common.ts';
import type { DeleteContract } from './delete-rpc.ts';

const ManifestEntry = z.object({
  source: z.string(),
  target: z.string(),
});
const CopyManifest = z.array(ManifestEntry);

export const commandDelete = command({
  name: 'delete',
  description: 'Delete source files listed in a copy manifest (TEMPORARY)', //FIXME: should be another kind of manifest?
  version: CliInfo.version,
  args: {
    config,
    verbose,
    dryRun: flag({
      type: boolean,
      long: 'dry-run',
      description: 'Log what would be deleted without performing the action',
      defaultValue: () => false,
    }),
    concurrency: option({ type: number, long: 'concurrency', defaultValue: () => 4 }),
    manifest: restPositionals({ type: string, displayName: 'manifest', description: 'Manifest of files to delete' }),
  },
  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();
    const pool = new WorkerRpcPool<DeleteContract>(args.concurrency, new URL('./delete-worker.ts', import.meta.url));

    const stats = { deleted: 0, skipped: 0 };
    const chunks = [];

    for (const manifestPath of args.manifest) {
      const json = await fsa.readJson<ActionCopy>(manifestPath);
      //FIXME: Do we want a specific manifest for delete?
      if (json.action !== 'copy') throw new Error('Invalid action: ' + String(json.action) + ' from:' + manifestPath);

      const manifest = CopyManifest.parse(json.parameters.manifest);
      const chunkSize = Math.ceil(manifest.length / args.concurrency);

      for (let i = 0; i < manifest.length; i += chunkSize) {
        chunks.push(
          pool.run('delete', {
            id: logId,
            manifest,
            start: i,
            size: chunkSize,
            dryRun: args.dryRun,
          }),
        );
      }
    }

    const results = await Promise.all(chunks);
    for (const result of results) {
      stats.deleted += result.deleted;
      stats.skipped += result.skipped;
    }

    await pool.close();
    logger.info(
      { deleteStats: stats, duration: performance.now() - startTime, dryRun: args.dryRun },
      'File:Delete:Done',
    );
  },
});
