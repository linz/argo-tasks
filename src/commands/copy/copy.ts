import { fsa } from '@chunkd/fs';
import { WorkerRpcPool } from '@wtrpc/core';
import { boolean, command, flag, number, option, restPositionals, string } from 'cmd-ts';
import { performance } from 'perf_hooks';
import * as z from 'zod';

import { CliInfo } from '../../cli.info.ts';
import { logger, logId } from '../../log.ts';
import type { ActionCopy } from '../../utils/actions.ts';
import { config, registerCli, verbose } from '../common.ts';
import { mergeStats } from './copy-helpers.ts';
import type { CopyContract, CopyStats } from './copy-rpc.ts';

const CopyValidator = z.object({ source: z.string(), target: z.string() });
const CopyManifest = z.array(CopyValidator);

export const commandCopy = command({
  name: 'copy',
  description: 'Copy a manifest of files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    force: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'force',
      description: 'Overwrite existing files',
      defaultValueIsSerializable: true,
    }),
    noClobber: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'no-clobber',
      description: 'Skip existing files',
      defaultValueIsSerializable: true,
    }),
    forceNoClobber: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'force-no-clobber',
      description: 'Overwrite changed files',
      defaultValueIsSerializable: true,
    }),
    fixContentType: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'fix-content-type',
      description: 'Correct content-type from "application/octet-stream" to common formats',
      defaultValueIsSerializable: true,
    }),
    compress: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'compress',
      description:
        'Compress copied files using zstandard (appends `.zst` to target file name when compressed). Note: Will not compress very small files',
      defaultValueIsSerializable: true,
    }),
    decompress: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'decompress',
      description:
        'Decompress copied files using zstandard (removes `.zst` from target file name when decompressed). Note: Will only decompress .zst files',
      defaultValueIsSerializable: true,
    }),
    deleteSource: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'delete-source',
      description: 'Delete source files after successful copy or compress action',
      defaultValueIsSerializable: true,
    }),
    concurrency: option({
      type: number,
      defaultValue: () => 4,
      long: 'concurrency',
      description: 'Concurrent number of worker threads to use for copying files',
    }),
    manifest: restPositionals({ type: string, displayName: 'location', description: 'Manifest of file to copy' }),
  },
  async handler(args) {
    registerCli(this, args);

    const workerUrl = new URL('./copy-worker.ts', import.meta.url);
    const pool = new WorkerRpcPool<CopyContract>(args.concurrency, workerUrl);

    let stats: CopyStats = {
      copied: { count: 0, bytesIn: 0, bytesOut: 0 },
      compressed: { count: 0, bytesIn: 0, bytesOut: 0 },
      decompressed: { count: 0, bytesIn: 0, bytesOut: 0 },
      deleted: { count: 0, bytesIn: 0, bytesOut: 0 },
      skipped: { count: 0, bytesIn: 0, bytesOut: 0 },
      processed: { count: 0, bytesIn: 0, bytesOut: 0 },
      total: { count: 0, bytesIn: 0, bytesOut: 0 },
    };

    let force = args.force;
    let noClobber = args.noClobber;

    if (args.forceNoClobber) {
      force = true;
      noClobber = true;
    }

    const manifestChunks = [];
    const startTime = performance.now();
    for (const m of args.manifest) {
      const json = await fsa.readJson<ActionCopy>(m);
      if (json.action !== 'copy') throw new Error('Invalid action: ' + String(json.action) + ' from:' + m);
      const data = json.parameters.manifest;
      const manifest = CopyManifest.parse(data);

      const chunkSize = Math.ceil(manifest.length / args.concurrency);
      for (let i = 0; i < manifest.length; i += chunkSize) {
        manifestChunks.push(
          pool.run('copy', {
            id: logId,
            manifest,
            start: i,
            size: chunkSize,
            force,
            noClobber,
            fixContentType: args.fixContentType,
            compress: args.compress,
            decompress: args.decompress,
            deleteSource: args.deleteSource,
          }),
        );
      }
    }

    const results = await Promise.all(manifestChunks);
    for (const result of results) {
      stats = mergeStats(stats, result);
    }

    await pool.close();
    logger.info({ copyStats: stats, duration: performance.now() - startTime }, 'File:Copy:Done');
  },
});
