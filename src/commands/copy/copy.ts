import { fsa } from '@chunkd/fs';
import { WorkerRpcPool } from '@wtrpc/core';
import { boolean, command, flag, number, option, restPositionals } from 'cmd-ts';
import { performance } from 'perf_hooks';
import { gunzipSync } from 'zlib';
import * as z from 'zod';

import { CliInfo } from '../../cli.info.js';
import { logger, logId } from '../../log.js';
import { ActionCopy } from '../../utils/actions.js';
import { PathStringOrUrlStringFromString } from '../../utils/cmd-ts-types.js';
import { JSONString, PathString, UrlString } from '../../utils/types.js';
import { config, registerCli, verbose } from '../common.js';
import { CopyContract } from './copy-rpc.js';

const CopyValidator = z.object({ source: z.string(), target: z.string() });
const CopyManifest = z.array(CopyValidator);

/**
 * Attempt to figure out how the configuration is pass to us
 * - Could be a path to a S3 location s3://foo/bar.json
 * - Could be a JSON document "[{}]"
 * - Could be a Base64'd Gzipped document
 */
async function tryParse(input: PathString | UrlString | JSONString): Promise<unknown> {
  if (input.startsWith('s3://') || input.startsWith('./') || input.startsWith('/')) {
    const json = await fsa.readJson<ActionCopy>(input);
    if (json.action !== 'copy') throw new Error('Invalid action: ' + json.action + ' from:' + input);
    return json.parameters.manifest;
  }
  if (input.startsWith('[') || input.startsWith('{')) return JSON.parse(input);
  return JSON.parse(gunzipSync(Buffer.from(input, 'base64url')).toString());
}

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
    concurrency: option({ type: number, long: 'concurrency', defaultValue: () => 4 }),
    manifest: restPositionals({
      type: PathStringOrUrlStringFromString,
      displayName: 'location',
      description: 'Manifest of file to copy',
    }),
  },
  async handler(args) {
    registerCli(this, args);

    const workerUrl = new URL('./copy-worker.js', import.meta.url);
    const pool = new WorkerRpcPool<CopyContract>(args.concurrency, workerUrl);

    const stats = { copied: 0, copiedBytes: 0, retries: 0, skipped: 0, skippedBytes: 0 };

    let force = args.force;
    let noClobber = args.noClobber;

    if (args.forceNoClobber) {
      force = true;
      noClobber = true;
    }

    const chunks = [];
    const startTime = performance.now();
    for (const m of args.manifest) {
      const data = await tryParse(m);
      const manifest = CopyManifest.parse(data) as { source: PathString | UrlString; target: PathString | UrlString }[];

      const chunkSize = Math.ceil(manifest.length / args.concurrency);
      for (let i = 0; i < manifest.length; i += chunkSize) {
        chunks.push(
          pool.run('copy', {
            id: logId,
            manifest,
            start: i,
            size: chunkSize,
            force,
            noClobber,
            fixContentType: args.fixContentType,
          }),
        );
      }
    }

    const results = await Promise.all(chunks);
    for (const result of results) {
      stats.copied += result.copied;
      stats.copiedBytes += result.copiedBytes;
      stats.skipped += result.skipped;
      stats.skippedBytes += result.skippedBytes;
    }

    await pool.close();
    logger.info({ copyStats: stats, duration: performance.now() - startTime }, 'File:Copy:Done');
  },
});
