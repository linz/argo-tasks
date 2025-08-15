// import { urlToString } from '../commands/common.ts';
import { makeRelative } from '../commands/stac-catalog/stac.catalog.ts';
import type { TiffLocation } from '../commands/tileindex-validate/tileindex.validate.ts';

export interface FileListEntry {
  /** output file name eg "AS21_10000_0103" */
  output: string;
  /** List of input files */
  input: URL[];
  includeDerived: boolean;
}
type StringFileListEntry = {
  output: string;
  input: string[];
  includeDerived: boolean;
};

export class FileListEntry implements FileListEntry {
  constructor(
    public output: string,
    public input: URL[],
    public includeDerived: boolean,
  ) {}

  toString(relativeTo?: URL): StringFileListEntry {
    if (relativeTo) {
      return {
        output: this.output,
        input: this.input.map((url) => makeRelative(relativeTo, url)),
        includeDerived: this.includeDerived,
      };
    }
    return { output: this.output, input: this.input.map((url) => url.href), includeDerived: this.includeDerived };
  }
}
/**
 * Get a list of mapsheets that can be created from the given TIFF files,
 * and associated list of which TIFF files are (fully or partially) within the bounds of each mapsheet.
 *
 * @param entries output tiles that will be generated and list of associated input tiles.
 * @param includeDerived whether the STAC file should include derived_from links to the input tiles.
 */
export function createFileList(entries: Map<string, TiffLocation[]>, includeDerived: boolean): StringFileListEntry[] {
  const output: StringFileListEntry[] = [];
  for (const [key, value] of entries) {
    output.push(
      new FileListEntry(
        key,
        value.map((item) => item.source),
        includeDerived,
      ).toString(),
    );
  }
  return output;
}
