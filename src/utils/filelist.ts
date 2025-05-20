import { urlToString } from '../commands/common.ts';
import type { TiffLocation } from '../commands/tileindex-validate/tileindex.validate.ts';

export type FileListEntry = {
  /** output file name eg "AS21_10000_0103" */
  output: string;
  /** List of input files */
  input: string[];
  includeDerived: boolean;
};

/**
 * Get a list of mapsheets that can be created from the given TIFF files,
 * and associated list of which TIFF files are (fully or partially) within the bounds of each mapsheet.
 *
 * @param entries output tiles that will be generated and list of associated input tiles.
 * @param includeDerived whether the STAC file should include derived_from links to the input tiles.
 */
export function createFileList(entries: Map<string, TiffLocation[]>, includeDerived: boolean): FileListEntry[] {
  const output: FileListEntry[] = [];
  for (const [key, value] of entries) {
    output.push({
      output: key,
      input: value.map((item) => urlToString(item.source)),
      includeDerived,
    });
  }
  return output;
}
