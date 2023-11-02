import { command, positional, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { imageryCrs, imageryProducts, regions } from './lint.constants.js';

export const commandLintInputs = command({
  name: 'lint-inputs',
  description: 'Pretty print JSON files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    path: positional({
      type: string,
      displayName: 'path',
      description: 'JSON file to load inputs from, must be a JSON Array',
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();
    logger.info('LintInputs:Start');
    if (!args.path) {
      throw new Error('No path Provided');
    }
    logger.info({ target: args.path }, 'LintInputs:Info');
    lintODRImageryPath(args.path);
    logger.info({ duration: performance.now() - startTime }, 'LintInputs:Done');
  },
});

export function lintODRImageryPath(path: string): void {
  const pathArray: string[] = path.replace('s3://', '').split('/');
  const bucket: string | undefined = pathArray[0];
  const region: string | undefined = pathArray[1];
  const dataset: string | undefined = pathArray[2];
  const product: string | undefined = pathArray[3];
  const crs: string | undefined = pathArray[4];

  // lint target path
  if (bucket == null || region == null || dataset == null || product == null || crs == null) {
    throw new Error(`Missing key from path: ${path}`);
  }
  if (bucket != 'nz-imagery') {
    throw new Error(`Incorrect Bucket: ${bucket}`);
  }
  if (!regions.includes(region)) {
    throw new Error(`Provided region not in region list: ${region}`);
  }
  if (!imageryProducts.includes(product)) {
    throw new Error(`Provided region not in imagery products list: ${product}`);
  }
  if (!imageryCrs.includes(crs)) {
    throw new Error(`Provided crs not in imagery crs list: ${crs}`);
  }
}
