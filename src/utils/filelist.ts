import { TiffLocation } from '../commands/tileindex-validate/tileindex.validate.js';

export type FileListEntry = {
  output: string;
  input: string[];
  includeDerived: boolean;
};

/**
 * Get the list of map sheets / tiles that intersect with the given bounding box.
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
