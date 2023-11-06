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

  if (bucket == null || region == null || dataset == null || product == null || crs == null) {
    throw new Error(`Missing Key in Path: ${path}`);
  }
  if (bucket === '' || region === '' || dataset === '' || product === '' || crs === '') {
    throw new Error(`Missing Key in Path: ${path}`);
  }
  console.log(crs);
  if (!path.endsWith(`${crs}/`)) {
    throw new Error(`Additional arguments in path: ${path}`);
  }
  if (imageryBucketNames.includes(bucket)) {
    lintImageryPath(region, product, crs);
  } else {
    throw new Error(`bucket not in bucket list: ${bucket}`);
  }
}

export function lintImageryPath(region: string, product: string, crs: string): void {
  if (!regions.includes(region)) {
    throw new Error(`region not in region list: ${region}`);
  }
  if (!imageryProducts.includes(product)) {
    throw new Error(`product not in product list: ${product}`);
  }
  if (!imageryCrs.includes(crs)) {
    throw new Error(`crs not in crs list: ${crs}`);
  }
}
