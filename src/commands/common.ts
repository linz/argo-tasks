import { boolean, flag, option, optional, string } from 'cmd-ts';

import { CliInfo } from '../cli.info.js';
import { registerFileSystem } from '../fs.register.js';
import { logger, registerLogger } from '../log.js';
import { isArgo } from '../utils/argo.js';

export const config = option({
  long: 'config',
  description: 'Location of role configuration file',
  type: optional(string),
});

export const verbose = flag({
  long: 'verbose',
  description: 'Verbose logging',
});

export const forceOutput = flag({
  type: boolean,
  defaultValue: () => false,
  long: 'force-output',
  description: 'force output additional files',
  defaultValueIsSerializable: true,
});

export function registerCli(cli: { name: string }, args: { verbose?: boolean; config?: string }): void {
  cleanArgs(args);
  registerLogger(args);
  registerFileSystem(args);

  logger.info({ package: CliInfo, cli: cli.name, args, isArgo: isArgo() }, 'Cli:Start');
}

/** Trim any extra special characters from the cli parser */
function cleanArgs(args: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      args[key] = value.trim();
    } else if (Array.isArray(value)) {
      args[key] = value.map((c) => {
        if (typeof c === 'string') return c.trim();
        return c;
      });
    }
  }
}

export const FileSizeMap = new Map<string, number>([
  ['kb', 1024],
  ['mb', 1024 * 1024],
  ['gb', 1024 * 1024 * 1024],
  ['tb', 1024 * 1024 * 1024 * 1024],
  ['ki', 1000],
  ['mi', 1000 * 1000],
  ['gi', 1000 * 1000 * 1000],
  ['ti', 1000 * 1000 * 1000 * 1000],
]);

/**
 * Convert a number eg "1KB" to size in bytes (1024)
 *
 * Rounded to the nearest byte
 */
export function parseSize(size: string): number {
  const textString = size.toLowerCase().replace(/ /g, '').trim();
  if (textString.endsWith('i') || textString.endsWith('b')) {
    const lastVal = textString.slice(textString.length - 2);
    const denominator = FileSizeMap.get(lastVal);
    if (denominator == null) throw new Error(`Failed to parse: ${size} as a file size`);
    return Math.round(denominator * Number(textString.slice(0, textString.length - 2)));
  }
  const fileSize = Number(textString);
  if (isNaN(fileSize)) throw new Error(`Failed to parse: ${size} as a file size`);
  return Math.round(fileSize);
}

/**
 * Guess the content type of a STAC file
 *
 * - application/geo+json - A STAC Item
 * - application/json - A STAC Catalog
 * - application/json - A STAC Collection
 *
 * Assumes anything ending with '.json' is a stac item
 * @see {@link https://github.com/radiantearth/stac-spec/blob/master/catalog-spec/catalog-spec.md#stac-media-types}
 */
export function guessStacContentType(path: string): string | undefined {
  if (path.endsWith('collection.json')) return 'application/json';
  if (path.endsWith('catalog.json')) return 'application/json';
  if (path.endsWith('.json')) return 'application/geo+json';
  return;
}
