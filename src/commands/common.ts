import { fsa } from '@chunkd/fs';
import { Tiff } from '@cogeotiff/core';
import { boolean, flag, option, optional, string } from 'cmd-ts';
import pLimit from 'p-limit';
import { fileURLToPath, pathToFileURL } from 'url';

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

/** 1220 is the starting prefix for all sha256 multihashes
 *  0x12 - ID of sha256 multi hash
 *  0x20 - 32 bytes (256 bits) of data
 */
export const Sha256Prefix = '1220';

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

/** Limit fetches to 25 concurrently **/
export const TiffQueue = pLimit(25);

/**
 * There is a minor difference between @chunkd/core and @cogeotiff/core
 * because @chunkd/core is a major version behind, when it upgrades this can be removed
 *
 * Because the major version upgrade for chunkd is a lot of work skip it for now (2023-11)
 *
 * @param loc location to load the tiff from
 * @returns Initialized tiff
 */
export function createTiff(loc: string): Promise<Tiff> {
  const source = fsa.source(loc);

  const tiff = new Tiff({
    url: tryParseUrl(loc),
    fetch: (offset, length): Promise<ArrayBuffer> => {
      /** Limit fetches concurrency see {@link TiffQueue} **/
      return TiffQueue(() => source.fetchBytes(offset, length));
    },
  });
  return tiff.init();
}

/**
 * Attempt to parse a location as a string as a URL,
 *
 * Relative paths will be converted into file urls.
 */
function tryParseUrl(loc: string): URL {
  try {
    return new URL(loc);
  } catch (e) {
    return pathToFileURL(loc);
  }
}

/**
 * When chunkd moves to URLs this can be removed
 *
 * But reading a file as a string with `file://....` does not work in node
 * it needs to be converted with `fileURLToPath`
 */
export function urlToString(u: URL): string {
  if (u.protocol === 'file:') return fileURLToPath(u);
  return u.href;
}
