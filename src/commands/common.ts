import { fsa } from '@chunkd/fs';
import { Tiff } from '@cogeotiff/core';
import { boolean, flag, option, optional, string, Type } from 'cmd-ts';
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
        return c as unknown;
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
export function tryParseUrl(loc: string): URL {
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

/**
 * Parse a input parameter as a URL.
 *
 * If it looks like a file path, it will be converted using `pathToFileURL`.
 **/
export const Url: Type<string, URL> = {
  from(str) {
    try {
      return Promise.resolve(new URL(str));
    } catch (e) {
      return Promise.resolve(pathToFileURL(str));
    }
  },
};

/**
 * Parse a input parameter as a URL which represents a folder.
 *
 * If it looks like a file path, it will be converted using `pathToFileURL`.
 * Any search parameters or hash will be removed, and a trailing slash added
 * to the path section if it's not present.
 **/
export const UrlFolder: Type<string, URL> = {
  async from(str) {
    const url = await Url.from(str);
    url.search = '';
    url.hash = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
  },
};

export interface StacCollectionLinz {
  'linz:lifecycle': string;
  'linz:geospatial_category': string;
  'linz:region': string;
  'linz:slug': string;
  'linz:security_classification': string;
  'linz:event_name'?: string;
  'linz:geographic_description'?: string;
}

export const geospatialDataCategories = {
  AERIAL_PHOTOS: 'aerial-photos',
  SCANNED_AERIAL_PHOTOS: 'scanned-aerial-photos',
  RURAL_AERIAL_PHOTOS: 'rural-aerial-photos',
  SATELLITE_IMAGERY: 'satellite-imagery',
  URBAN_AERIAL_PHOTOS: 'urban-aerial-photos',
  DEM: 'dem',
  DSM: 'dsm',
};
