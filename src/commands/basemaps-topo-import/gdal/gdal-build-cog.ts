import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';

import { urlToString } from '../../common.js';

export const DEFAULT_TRIM_PIXEL_RIGHT = 1.7;

interface gdalBuildCogOptions {
  /**
   * The number of pixels to remove from the right side of the imagery.
   *
   * If the value is a decimal number ending in above .5, the number of
   * pixels removed will be the value rounded up to the nearest integer.
   * The imagery will then be scaled to fulfil the difference.
   *
   */
  pixelTrim?: number;
}

/**
 * Constructs a 'gdal_translate' GdalCommand.
 *
 * @param input
 * @param output
 * @param opts
 * @returns
 */
export function gdalBuildCogCommands(
  input: URL,
  output: URL,
  width: number,
  height: number,
  opts?: gdalBuildCogOptions,
): GdalCommand {
  const pixelTrim = opts?.pixelTrim ?? DEFAULT_TRIM_PIXEL_RIGHT;

  const command: GdalCommand = {
    output,
    command: 'gdal_translate',
    args: [
      ['-q'], // Supress non-error output
      ['-stats'], // Force stats (re)computation
      ['-of', 'COG'], // Output format
      ['-srcwin', '0', '0', `${width - pixelTrim}`, `${height}`],

      // https://gdal.org/en/latest/drivers/raster/cog.html#creation-options
      ['-co', 'BIGTIFF=NO'],
      ['-co', 'BLOCKSIZE=512'],
      ['-co', 'COMPRESS=WEBP'],
      ['-co', 'NUM_THREADS=ALL_CPUS'], // Use all CPUS
      ['-co', 'OVERVIEW_COMPRESS=WEBP'],
      ['-co', 'OVERVIEWS=IGNORE_EXISTING'],
      ['-co', 'OVERVIEW_QUALITY=90'],
      ['-co', 'OVERVIEW_RESAMPLING=LANCZOS'],
      ['-co', 'QUALITY=100'],
      ['-co', 'SPARSE_OK=TRUE'], // Allow for sparse writes

      // https://gdal.org/en/latest/drivers/raster/cog.html#reprojection-related-creation-options
      ['-co', 'ADD_ALPHA=YES'],

      urlToString(input),
      urlToString(output),
    ]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };

  return command;
}
