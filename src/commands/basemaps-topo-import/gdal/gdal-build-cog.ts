import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { GdalResampling } from '@basemaps/cogify/build/cogify/stac.js';

import { urlToString } from '../../common.js';

export const DEFAULT_TRIM_PIXEL_RIGHT = 1.7;

interface gdalBuildCogOptions {
  /**
   * Resampling algorithm. Nearest is the default.
   *
   * @link
   * https://gdal.org/en/stable/programs/gdal_translate.html#cmdoption-gdal_translate-r
   */
  resamplingMethod?: GdalResampling;
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

      // https://gdal.org/en/latest/drivers/raster/cog.html#creation-options
      ['-srcwin', `0`, `0`, `${width - pixelTrim}`, `${height}`],
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
    ]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };

  if (opts?.resamplingMethod != null) {
    command.args.push('-r', opts.resamplingMethod);
  }

  command.args.push(urlToString(input), urlToString(output));

  return command;
}
