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
  const pathObj = {
    bucket: pathArray[0],
    region: pathArray[1],
    dataset: pathArray[2],
    product: pathArray[3],
    crs: pathArray[4],
  };

  // lint target path
  if (pathObj.bucket != null && pathObj.bucket != 'nz-imagery') {
    throw new Error(`Incorrect Bucket: ${pathObj.bucket}`);
  }
  if (pathObj.region != null && !regions.includes(pathObj.region)) {
    throw new Error(`Provided region not in region list: ${pathObj.region}`);
  }
  if (pathObj.product != null && !imageryProducts.includes(pathObj.product)) {
    throw new Error(`Provided region not in imagery products list: ${pathObj.product}`);
  }
  if (pathObj.crs != null && !imageryCrs.includes(pathObj.crs)) {
    throw new Error(`Provided crs not in imagery crs list: ${pathObj.crs}`);
  }
}
