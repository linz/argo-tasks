import { fsa } from '@chunkd/fs';

import type { TiffLocation } from '../commands/tileindex-validate/tileindex.validate.ts';
export const HttpProtocols = ['https:', 'http:'];

/**
 * Create a string from a URL that is URI decoded based on the protocol
 *
 * For http(s):// URLs it returns the full URL (with encoded characters)
 * For other protocols it decodes the characters and
 * for file:// URL it creates a relative path from the current working directory
 *
 * @param targetLocation URL to convert to string
 * @returns string representation of the URL
 */
export function protocolAwareString(targetLocation: URL): string {
  return makeRelative(fsa.toUrl('./'), targetLocation, false);
}

/**
 * Convert a path to relative
 *
 * https://foo.com + https://foo.com/bar.html => ./bar.html
 * s3://foo/ + s3://foo/bar/baz.html => ./bar/baz.html
 * file:///home/blacha + file:///home/blacha/index.json => ./index.json
 *
 * @param basePath path to make relative to
 * @param filePath target file
 * @param strict whether to throw an error if the filePath is not relative to the basePath
 *
 * @returns relative path to file
 */
export function makeRelative(basePath: URL, filePath: URL, strict = true): string {
  const basePathFolder = new URL('./', basePath); // Ensure basePath ends with "/"
  // If the filePath starts with the basePathFolder, we can return the relative path
  if (strict && !filePath.href.startsWith(basePathFolder.href)) {
    throw new Error(`FilePaths are not relative base: ${basePathFolder.href} file: ${filePath.href}`);
  }
  const relativePath = filePath.href.replace(basePathFolder.href, './');
  if (HttpProtocols.includes(filePath.protocol)) {
    return relativePath;
  }
  return decodeURIComponent(relativePath);
}

export interface FileListEntry {
  /** output file name eg "AS21_10000_0103" */
  output: string;
  /** List of input files */
  input: URL[];
  includeDerived: boolean;
  toJSON(): FileListJsonEntry;
  toString(): string;
}

interface FileListJsonEntry {
  output: string;
  input: string[];
  includeDerived: boolean;
}

export class FileListEntryClass implements FileListEntry {
  output: string;
  input: URL[];
  includeDerived: boolean;

  constructor(output: string, input: URL[], includeDerived: boolean) {
    this.output = output.trim();
    this.input = input;
    this.includeDerived = includeDerived;
    if (this.output.length === 0) {
      throw new Error('Output name cannot be empty');
    }
    if (this.input.length === 0) {
      throw new Error('Input list cannot be empty');
    }
  }
  toJSON(): FileListJsonEntry {
    return JSON.parse(this.toString()) as FileListJsonEntry;
  }
  toString(): string {
    const stringUrls = this.input.map((url) => makeRelative(fsa.toUrl('./'), url, false));
    return JSON.stringify({
      output: this.output,
      input: stringUrls,
      includeDerived: this.includeDerived,
    });
  }
}

/**
 * Get a list of mapsheets that can be created from the given TIFF files,
 * and associated list of which TIFF files are (fully or partially) within the bounds of each mapsheet.
 *
 * @param entries output tiles that will be generated and list of associated input tiles.
 * @param includeDerived whether the STAC file should include derived_from links to the input tiles.
 // * @param relativeTo optional URL to make the input paths relative to, defaults to the current working directory.
 *
 * @returns list of mapsheets with associated input files.
 */
export function createFileList(entries: Map<string, TiffLocation[]>, includeDerived: boolean): FileListEntryClass[] {
  const output: FileListEntryClass[] = [];
  for (const [key, value] of entries) {
    output.push(
      new FileListEntryClass(
        key,
        value.map((item) => item.source),
        includeDerived,
      ),
    );
  }
  return output;
}
