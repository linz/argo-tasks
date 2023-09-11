import { fsa } from '@chunkd/fs';
import { command, option, optional, positional, string } from 'cmd-ts';
import { basename } from 'path';
import prettier from 'prettier';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { getFiles } from '../../utils/chunk.js';
import { config, registerCli, verbose } from '../common.js';

function isJson(x: string): boolean {
  const search = x.toLowerCase();
  return search.endsWith('.json');
}

export const defaultPrettierFormat: prettier.Options = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  useTabs: false,
  tabWidth: 2,
};

export const commandPrettyPrint = command({
  name: 'pretty-print',
  description: 'Pretty print JSON files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    target: option({
      type: optional(string),
      long: 'target',
      description: 'Use if files have to be saved somewhere else instead of overwriting the source (testing).',
    }),
    path: positional({ type: string, displayName: 'path', description: 'Path of the files to format with Prettier' }),
  },

  async handler(args) {
    registerCli(this, args);
    logger.info('PrettyPrint:Start');
    const files = await getFiles([args.path]);
    const jsonFiles = files.flat().filter(isJson);
    if (jsonFiles.length === 0) throw new Error('No Files found');
    // test if can access on of the file
    if (jsonFiles[0]) await fsa.head(jsonFiles[0]);
    // format files
    await Promise.all(jsonFiles.map((f: string) => formatFile(f, args.target)));
    logger.info({ formatted: jsonFiles.length }, 'PrettyPrint:Done');
  },
});

async function formatFile(path: string, target = ''): Promise<void> {
  logger.info({ file: path }, 'Prettier:Format');
  const formatted = await prettier.format(JSON.stringify(await fsa.readJson(path)), {
    ...defaultPrettierFormat,
    parser: 'json',
  });
  if (target) {
    // FIXME: can be duplicate files
    path = fsa.join(target, basename(path));
  }
  fsa.write(path, Buffer.from(formatted));
}
