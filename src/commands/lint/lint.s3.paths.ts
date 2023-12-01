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
  const url = new URL(path);

  if (imageryBucketNames.includes(url.hostname)) {
    lintImageryPath(url.pathname);
  } else {
    throw new Error(`bucket not in bucket list: ${url.hostname}`);
  }
}

export function lintImageryPath(pathName: string): void {
  const [, region, dataset, product, crs] = pathName.split('/', 5);

  if (region === undefined || dataset === undefined || product === undefined || crs === undefined) {
    throw new Error(`Missing Key in Path: ${pathName}`);
  }
  if (pathName.split('/').length < 6) {
    throw new Error(`Missing key in Path: ${pathName}`);
  }
  if (pathName.split('/').length > 6) {
    throw new Error(`Too many keys in Path: ${pathName}`);
  }
  if (!regions.includes(region)) {
    throw new Error(`region not in region list: ${region}`);
  }
  if (!imageryProducts.includes(product)) {
    throw new Error(`product not in product list: ${product}`);
  }
  if (!imageryCrs.includes(Number(crs))) {
    throw new Error(`crs not in crs list: ${crs}`);
  }
  const resolution = dataset.split('_').pop()?.replace('m', '');
  const resolutionFraction = resolution?.split('.', 2)[1];
  if (resolutionFraction?.endsWith('0')) {
    throw new Error(`Trailing 0 in resolution fraction of dataset name: ${dataset}`);
  }
}
