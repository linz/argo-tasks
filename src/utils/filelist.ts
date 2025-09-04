import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
  if (HttpProtocols.includes(targetLocation.protocol)) {
    return targetLocation.href;
  }
  if (targetLocation.protocol === 'file:') {
    return fileURLToPath(targetLocation);
  }
  return decodeURIComponent(targetLocation.href);
}

/**
 * URL to relative path converter.
 *
 * https://foo.com + https://foo.com/bar.html => ./bar.html
 * s3://foo/ + s3://foo/bar/baz.html => ./bar/baz.html
 * file:///home/blacha + file:///home/blacha/index.json => ./index.json
 *
 * @param baseLocation URL to make relative to
 * @param fileLocation target file
 * @param strict whether to throw an error if the fileLocation is not relative to the baseLocation
 *
 * @returns relative path to file
 */
export function makeRelative(baseLocation: URL, fileLocation: URL, strict = true): string {
  const baseLocationFolder = new URL('./', baseLocation); // Ensure baseLocation ends with "/" (cuts off anything after the final "/", i.e. a file name)
  // If the fileLocation starts with baseLocationFolder, we can return the relative path of fileLocation
  if (strict && !fileLocation.href.startsWith(baseLocationFolder.href)) {
    throw new Error(
      `fileLocation is not a subfolder of baseLocation: ${protocolAwareString(baseLocationFolder)} file: ${protocolAwareString(fileLocation)}`,
    );
  }
  if (fileLocation.protocol === 'file:') {
    let relativeFilePath = path.relative(fileURLToPath(baseLocationFolder), fileURLToPath(fileLocation));
    if (
      !path.isAbsolute(relativeFilePath) &&
      !relativeFilePath.startsWith('./') &&
      !relativeFilePath.startsWith('../')
    ) {
      relativeFilePath = `./${relativeFilePath}`;
    }
    return relativeFilePath;
  }

  if (HttpProtocols.includes(fileLocation.protocol)) {
    return fileLocation.href.replace(baseLocationFolder.href, './');
  }
  return decodeURIComponent(fileLocation.href.replace(baseLocationFolder.href, './'));
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
    const stringUrls = this.input.map((location) => makeRelative(pathToFileURL('./'), location, false));
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
