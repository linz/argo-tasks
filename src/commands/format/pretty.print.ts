import { fsa } from '@chunkd/fs';
import { command, option, optional, positional } from 'cmd-ts';
import { basename } from 'path';
import prettier from 'prettier';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { getFiles } from '../../utils/chunk.js';
import { PathStringOrUrlStringFromString } from '../../utils/cmd-ts-types.js';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.js';
import { PathString, UrlString } from '../../utils/types.js';
import { config, registerCli, verbose } from '../common.js';

function isJson(path: PathString | UrlString): boolean {
  const search = path.toLowerCase();
  return search.endsWith('.json');
}

export const commandPrettyPrint = command({
  name: 'pretty-print',
  description: 'Pretty print JSON files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    target: option({
      type: optional(PathStringOrUrlStringFromString),
      long: 'target',
      description: 'Use if files have to be saved somewhere else instead of overwriting the source (testing)',
    }),
    path: positional({
      type: PathStringOrUrlStringFromString,
      displayName: 'path',
      description: 'Path of the files to pretty print',
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();
    logger.info('PrettyPrint:Start');
    if (args.target) {
      logger.info({ target: args.target }, 'PrettyPrint:Info');
    }

    const files = await getFiles([args.path]);
    const jsonFiles = files.flat().filter(isJson);
    if (jsonFiles.length === 0) throw new Error('No Files found');

    // test if can access one of the file
    if (jsonFiles[0]) await fsa.head(jsonFiles[0]);

    // format files
    await Promise.all(jsonFiles.map((f: PathString | UrlString) => formatFile(f, args.target)));
    logger.info({ fileCount: jsonFiles.length, duration: performance.now() - startTime }, 'PrettyPrint:Done');
  },
});

/**
 * Format the file
 *
 * @param path of the file to format
 * @param target where to save the output. If not specified, overwrite the original file.
 */
export async function formatFile(
  path: PathString | UrlString,
  target: PathString | UrlString = '' as UrlString,
): Promise<void> {
  logger.debug({ file: path }, 'PrettyPrint:RunPrettier');
  const prettyPrinted = await prettyPrint(JSON.stringify(await fsa.readJson(path)), DEFAULT_PRETTIER_FORMAT);
  if (target) {
    // FIXME: can be duplicate files
    path = fsa.join(target, basename(path)) as PathString | UrlString;
  }

  await fsa.write(path, Buffer.from(prettyPrinted));
}

/**
 * Pretty prints a JSON document using prettier.
 *
 * @param jsonStr a stringify JSON to pretty print
 * @param config a Prettier configuration
 * @returns the stringify JSON pretty printed
 */
export async function prettyPrint(jsonStr: string, config: prettier.Options): Promise<string> {
  return await prettier.format(jsonStr, {
    ...config,
    parser: 'json',
  });
}
