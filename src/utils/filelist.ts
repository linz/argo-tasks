import { fsa } from '@chunkd/fs';

import { makeRelative } from '../commands/stac-catalog/stac.catalog.ts';
import type { TiffLocation } from '../commands/tileindex-validate/tileindex.validate.ts';
export const HttpProtocols = ['https:', 'http:'];
export function protocolAwareString(targetLocation: URL) {
  return makeRelative(fsa.toUrl('./'), targetLocation, false);

export interface FileListEntry {
  /** output file name eg "AS21_10000_0103" */
  output: string;
  /** List of input files */
  input: URL[];
  includeDerived: boolean;
  toJSON(): JSON;
  toString(): string;
}
export class FileListEntry implements FileListEntry {
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
  toJSON(): JSON {
    return JSON.parse(this.toString());
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
export function createFileList(
  entries: Map<string, TiffLocation[]>,
  includeDerived: boolean,
): FileListEntry[] {
  const output: FileListEntry[] = [];
  for (const [key, value] of entries) {
    output.push(
      new FileListEntry(
        key,
        value.map((item) => item.source),
        includeDerived,
      ),
    );
  }
  return output;
}
