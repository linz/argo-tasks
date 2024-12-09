import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { GdalResampling } from '@basemaps/cogify/build/cogify/stac.js';

import { urlToString } from '../../common.js';

interface GdalBuildVrtOptions {
  /**
   * Resampling algorithm. Nearest is the default.
   *
   * @link
   * https://gdal.org/en/latest/programs/gdalbuildvrt.html#cmdoption-gdalbuildvrt-r
   */
  resamplingMethod?: GdalResampling;

  /**
   * Background color.
   *
   * @example
   * '208 231 244' // NZ Topo Raster sea colour (RGB as 'RRR GGG BBB')
   *
   * @links
   * https://gdal.org/en/latest/programs/gdalbuildvrt.html#cmdoption-gdalbuildvrt-vrtnodata
   * https://gdal.org/en/latest/programs/gdalbuildvrt.html#vrtnodata
   */
  background?: string;
}

/**
 * Constructs a 'gdalBuildVrt' GdalCommand.
 *
 * @param targetVrt
 * @param source
 * @param opts
 * @returns
 */
export function gdalBuildVrt(targetVrt: URL, source: URL[], opts?: GdalBuildVrtOptions): GdalCommand {
  if (source.length === 0) throw new Error('No source files given for :' + targetVrt.href);
  const command: GdalCommand = {
    output: targetVrt,
    command: 'gdalbuildvrt',
    args: ['-addalpha'],
  };

  if (opts?.background != null) {
    command.args.push('-hidenodata', '-vrtnodata', opts.background);
  }

  if (opts?.resamplingMethod != null) {
    command.args.push('-r', opts.resamplingMethod);
  }

  command.args.push(urlToString(targetVrt), ...source.map(urlToString));

  return command;
}
