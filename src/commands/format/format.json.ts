import { fsa } from '@chunkd/fs';
import { boolean, command, flag, option, optional, positional, string } from 'cmd-ts';
import { basename } from 'path';
import prettier from 'prettier';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { getFiles } from '../../utils/chunk.js';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.js';
import { config, guessStacContentType, registerCli, verbose } from '../common.js';

function isJson(x: string): boolean {
  const search = x.toLowerCase();
  return search.endsWith('.json');
}

export const commandFormatJson = command({
  name: 'format-json',
  description: 'Format JSON files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    target: option({
      type: optional(string),
      long: 'target',
      description: 'Use if files have to be saved somewhere else instead of overwriting the source (testing)',
    }),
    fixContentType: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'fix-content-type',
      description: 'Append a guessed content-type to the S3 object.',
      defaultValueIsSerializable: true,
    }),
    path: positional({ type: string, displayName: 'path', description: 'Path of the files to pretty print' }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();
    logger.info('FormatJson:Start');
    if (args.target) {
      logger.info({ target: args.target }, 'FormatJson:Info');
    }

    const files = await getFiles([args.path]);
    const jsonFiles = files.flat().filter(isJson);
    if (jsonFiles.length === 0) throw new Error('No Files found');

    // test if can access one of the file
    if (jsonFiles[0]) await fsa.head(jsonFiles[0]);

    // format files
    await Promise.all(jsonFiles.map((f: string) => formatFile(f, args.target, args.fixContentType)));
    logger.info({ fileCount: jsonFiles.length, duration: performance.now() - startTime }, 'FormatJson:Done');
  },
});

/**
 * Format the file
 *
 * @param path of the file to format
 * @param target where to save the output. If not specified, overwrite the original file.
 * @param fixContentType if true will set the `contentType` with a guessed value. @see guessStacContentType
 */
export async function formatFile(path: string, target = '', fixContentType: boolean = false): Promise<void> {
  logger.debug({ file: path }, 'FormatJson:RunPrettier');
  const prettyPrinted = await prettyPrint(JSON.stringify(await fsa.readJson(path)), DEFAULT_PRETTIER_FORMAT);
  if (target) {
    // FIXME: can be duplicate files
    path = fsa.join(target, basename(path));
  }
  let meta = {};
  if (fixContentType) meta = { contentType: guessStacContentType(path) };

  fsa.write(path, Buffer.from(prettyPrinted), meta);
}

/**
 * Pretty prints a JSON document using prettier.
 *
 * @param jsonStr a stringify JSON to pretty print
 * @param config a Prettier configuration
 * @returns the stringify JSON pretty printed
 */
export async function prettyPrint(jsonStr: string, config: prettier.Options): Promise<string> {
  const formatted = await prettier.format(jsonStr, {
    ...config,
    parser: 'json',
  });

  return formatted;
}
