import { command, positional, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { imageryBucketNames, imageryCrs, imageryProducts, regions } from './lint.constants.js';

export class MissingKeyError extends Error {
  constructor(path: string) {
    super(`Missing Key in Path: ${path}`);
    this.name = 'MissingKeyError';
  }
}

export class AdditionalKeyError extends Error {
  constructor(path: string) {
    super(`Additional arguments in path: ${path}`);
    this.name = 'AdditionalKeyError';
  }
}

export class InvalidKeyError extends Error {
  constructor(type: string, value: string) {
    super(`${type} not in ${type} list: ${value}`);
    this.name = 'InvalidKeyError';
  }
}

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
    throw new MissingKeyError(path);
  }
  if (bucket === '' || region === '' || dataset === '' || product === '' || crs === '') {
    throw new MissingKeyError(path);
  }
  console.log(crs);
  if (!path.endsWith(`${crs}/`)) {
    throw new AdditionalKeyError(path);
  }
  if (imageryBucketNames.includes(bucket)) {
    lintImageryPath(region, product, crs);
  } else {
    throw new InvalidKeyError('Bucket', bucket);
  }
}

export function lintImageryPath(region: string, product: string, crs: string): void {
  if (!regions.includes(region)) {
    throw new InvalidKeyError('region', region);
  }
  if (!imageryProducts.includes(product)) {
    throw new InvalidKeyError('product', product);
  }
  if (!imageryCrs.includes(crs)) {
    throw new InvalidKeyError('crs', crs);
  }
}
