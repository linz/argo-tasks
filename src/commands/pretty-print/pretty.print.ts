import { fsa } from '@chunkd/fs';
import { command, option, optional, positional } from 'cmd-ts';
import prettier from 'prettier';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { getFiles } from '../../utils/chunk.ts';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import { config, isJson, registerCli, UrlFolder, UrlList, verbose } from '../common.ts';

export const commandPrettyPrint = command({
  name: 'pretty-print',
  description: 'Pretty print JSON files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    target: option({
      type: optional(UrlFolder),
      long: 'target',
      description: 'Use if files have to be saved somewhere else instead of overwriting the source (testing)',
    }),
    path: positional({ type: UrlList, displayName: 'path', description: 'Path of the files to pretty print' }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();
    logger.info('PrettyPrint:Start');
    if (args.target) {
      logger.info({ target: protocolAwareString(args.target) }, 'PrettyPrint:Info');
    }

    const files = await getFiles(args.path);
    const jsonFiles = files.flat().filter(isJson);
    if (jsonFiles.length === 0) throw new Error('No Files found');

    // test if can access one of the file
    if (jsonFiles[0]) await fsa.head(jsonFiles[0]);

    // format files
    await Promise.all(jsonFiles.map((f: URL) => formatFile(f, args.target)));
    logger.info({ fileCount: jsonFiles.length, duration: performance.now() - startTime }, 'PrettyPrint:Done');
  },
});

/**
 * Format the file
 *
 * @param sourceLocation of the file to format
 * @param targetLocation where to save the output. If not specified, overwrite the original file.
 */
export async function formatFile(sourceLocation: URL, targetLocation?: URL): Promise<void> {
  logger.debug({ file: protocolAwareString(sourceLocation) }, 'PrettyPrint:RunPrettier');
  let outputLocation = sourceLocation;
  const prettyPrinted = await prettyPrint(JSON.stringify(await fsa.readJson(sourceLocation)), DEFAULT_PRETTIER_FORMAT);
  if (targetLocation) {
    // FIXME: can be duplicate files
    outputLocation = new URL(sourceLocation.pathname.replace(new RegExp('.*/', ''), ''), targetLocation);
  }

  await fsa.write(outputLocation, Buffer.from(prettyPrinted));
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
