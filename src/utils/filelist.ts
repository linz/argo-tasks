import type { TiffLocation } from '../commands/tileindex-validate/tileindex.validate.ts';

export type FileListEntry = {
  output: string;
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
export function createFileList(
  entries: Map<string, TiffLocation[] | string[]>,
  includeDerived: boolean,
): FileListEntry[] {
  return [...entries.keys()].map((key) => {
    const value = entries.get(key);
    if (!value) {
      throw new Error(`Key "${key}" not found in entries map`);
    }
    const processedInput = value.map((item) => (typeof item === 'string' ? item : item.source));

    return {
      output: key,
      input: processedInput,
      includeDerived,
    };
  });
}
