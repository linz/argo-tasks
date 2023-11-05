import { command, positional, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { imageryBucketNames, imageryCrs, imageryProducts, regions } from './lint.constants.js';

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
    lintPath(args.path);
    logger.info({ duration: performance.now() - startTime }, 'LintInputs:Done');
  },
});

export function lintPath(path: string): void {
  const [bucket, region, dataset, product, crs] = path.replace('s3://', '').split('/', 5);

  if (bucket == null) {
    throw new Error(`No Bucket Specified: ${path}`);
  }
  if (region == null || dataset == null || product == null || crs == null) {
    throw new Error(`Missing key from path: ${path}`);
  }
  if (imageryBucketNames.includes(bucket)) {
    lintImageryPath(region, product, crs);
  } else {
    throw new Error(`Bucket not bucket list: ${bucket}`);
  }
}

export function lintImageryPath(region: string, product: string, crs: string): void {
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
