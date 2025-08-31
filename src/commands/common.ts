import { fsa } from '@chunkd/fs';
import { Tiff } from '@cogeotiff/core';
import type { Type } from 'cmd-ts';
import { boolean, flag, option, optional, string } from 'cmd-ts';

import { registerFileSystem } from '../fs.register.ts';
import { logger, registerLogger } from '../log.ts';
import { isArgo } from '../utils/argo.ts';

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

  logger.info({ cli: cli.name, args, isArgo: isArgo() }, 'Cli:Start');
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

/**
 * There is a minor difference between @chunkd/core and @cogeotiff/core
 * because @chunkd/core is a major version behind, when it upgrades this can be removed
 *
 * Because the major version upgrade for chunkd is a lot of work skip it for now (2023-11)
 * 2025-08: chunkd has been upgraded to v11 but this still seems useful
 *
 * @param loc location to load the tiff from
 * @returns Initialized tiff
 */
export function createTiff(loc: URL): Promise<Tiff> {
  const source = fsa.source(loc);
  const tiff = new Tiff(source);
  return tiff.init();
}

/** Ensure the provided url ends with a slash */
export function ensureTrailingSlash(location: URL): URL {
  if (!location.pathname.endsWith('/')) location.pathname += '/';
  return location;
}

/**
 * Parse an input parameter as a URL.
 *
 * If it looks like a file path, it will be converted using `pathToFileURL`.
 **/
export const Url: Type<string, URL> = {
  from(str) {
    return Promise.resolve(fsa.toUrl(str));
  },
};

/**
 * Remove the file extension from a URL, typically used to remove `.tiff` or `.tif` extensions.
 *
 * @param location
 * @param pattern to replace
 * @param replaceValue to replace the pattern with, defaults to an empty string
 */
export function replaceUrlExtension(location: URL, pattern: RegExp, replaceValue: string = ''): URL {
  return fsa.toUrl(location.href.replace(pattern, replaceValue));
}

/**
 * Check if a URL path ends with a given string (e.g. filename or file extension).
 *
 * @param location URL to check (e.g. a TIFF file URL)
 * @param needle the term to check for
 * @param caseSensitive whether the check should be case-sensitive, defaults to false
 * @returns true if the URL path ends with the specified term
 */
export function urlPathEndsWith(location: URL, needle: string, caseSensitive = false): boolean {
  let haystack = location.pathname;
  if (!caseSensitive) {
    needle = needle.toLowerCase();
    haystack = location.pathname.toLowerCase();
  }
  return haystack.endsWith(needle);
}

/**
 * Parse an input parameter as a URL which represents a folder.
 *
 * If it looks like a file path, it will be converted using `pathToFileURL`.
 * Any search parameters or hash will be removed, and a trailing slash added
 * to the path section if it's not present.
 **/
export const UrlFolder: Type<string, URL> = {
  async from(str) {
    const location = await Url.from(str);
    location.search = '';
    location.hash = '';
    return ensureTrailingSlash(location);
  },
};

const PathSplitCharacters = /[;\n]/;
/**
 * Parse an input parameter as a list of URLs which represent folders.
 *
 * If it looks like a file path, it will be converted using `pathToFileURL`.
 * Any search parameters or hash will be removed, and a trailing slash added
 * to the path section if it's not present.
 **/
export const UrlFolderList: Type<string, URL[]> = {
  async from(str) {
    const urls = str
      .split(PathSplitCharacters)
      .map((str) => str.trim())
      .filter((str) => str.length > 0)
      .map((str) => UrlFolder.from(str));
    return await Promise.all(urls);
  },
};

/**
 * Parse an input parameter as a list of URLs.
 *
 * If it looks like a file path, it will be converted using `pathToFileURL`.
 **/
export const UrlList: Type<string | string[], URL[]> = {
  async from(str: string | string[]) {
    let strs: string[] = [];
    if (Array.isArray(str)) {
      strs = str.flat();
    } else if (str.startsWith('[')) {
      // If the input is a JSON array, parse it
      strs = JSON.parse(str) as string[];
      if (!Array.isArray(strs)) {
        throw new Error('Input must be a JSON array of URLs');
      }
    } else {
      strs = str
        .split(PathSplitCharacters)
        .map((str) => str.trim())
        .filter((str) => str.length > 0);
    }
    const promises: Promise<URL>[] = strs
      .map((str) => str.trim())
      .filter((str) => str.length > 0)
      .map((str) => Url.from(str))
      .flat();
    return Promise.all(promises);
  },
};

/**
 * Parse an input string as a list of items.
 * If it looks like a JSON string, it will be parsed.
 * Other strings will be retained.
 *
 * @example
 * ```typescript
 * StrList.from('["item1","item2",["item3", "item4"]]')  // returns ["item1", "item2", "item3", "item4"]
 * StrList.from(['item1', 'item2', ['item3', 'item4']])  // returns ["item1", "item2", "item3", "item4"]
 * StrList.from('item1,item2,item3,item4')  // returns ["item1,item2,item3,item4"]
 * StrList.from('item1')  // returns ["item1"]
 * ```
 **/
export const StrList: Type<string | string[], string[]> = {
  async from(item: string | string[]) {
    let items: string[] = [];
    if (Array.isArray(item)) {
      items = item.flat();
    } else if (typeof item === 'string' && item.startsWith('[')) {
      // If the input is a JSON array, parse it
      const parsedItem = JSON.parse(item) as string[];
      items = (await Promise.all(parsedItem.map((str) => StrList.from(str)))).flat();
      if (!Array.isArray(items)) {
        throw new Error('Input must be a JSON array of strings');
      }
    } else {
      items = [item];
    }
    const results: string[] = items.flat();
    return results;
  },
};

/**
 * Remove a trailing 'm' from an input value and validate the input is a number.
 *
 * @param str input value
 * @returns value without trailing 'm' (if it exists)
 * @throws if input is not a valid number
 */
export const MeterAsString: Type<string, string> = {
  from(str) {
    const meters = str.endsWith('m') ? str.slice(0, -1) : str;

    if (isNaN(Number(meters))) {
      throw new Error(`Invalid value: ${meters}. must be a number.`);
    }

    return Promise.resolve(meters);
  },
};

/**
 * Parse an input parameter as a URL which represents a S3 path.
 */
export const S3Path: Type<string, URL> = {
  async from(str) {
    if (!str.startsWith('s3://')) throw new Error('Path is not S3');
    return await Url.from(str);
  },
};

/** Does this URL point to a JSON file (based on extension) */
export function isJson(location: URL): boolean {
  return urlPathEndsWith(location, '.json');
}

/**
 * Guess the content-type of a STAC file
 *
 * - application/geo+json - A STAC Item
 * - application/json - A STAC Catalog
 * - application/json - A STAC Collection
 *
 * Assumes anything ending with '.json' is a stac item
 * @see {@link https://github.com/radiantearth/stac-spec/blob/master/catalog-spec/catalog-spec.md#stac-media-types}
 */
export function guessStacContentType(location: URL): string | undefined {
  if (urlPathEndsWith(location, 'collection.json')) return 'application/json';
  if (urlPathEndsWith(location, 'catalog.json')) return 'application/json';
  if (urlPathEndsWith(location, '.json')) return 'application/geo+json';
  if (urlPathEndsWith(location, '.geojson')) return 'application/geo+json';
  return;
}
