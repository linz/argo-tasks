import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { GdalResampling } from '@basemaps/cogify/build/cogify/stac.js';
import { Epsg } from '@basemaps/geo';

import { urlToString } from '../../common.js';

interface gdalBuildVrtWarpOptions {
  /**
   * Resampling algorithm. Nearest is the default.
   *
   * @link
   * https://gdal.org/en/latest/programs/gdalwarp.html#cmdoption-gdalwarp-r
   */
  resamplingMethod?: GdalResampling;
}

/**
 * Constructs a 'gdalwarp' GdalCommand.
 *
 * @param targetVrt
 * @param sourceVrt
 * @param sourceProj
 * @param opts
 * @returns
 */
export function gdalBuildVrtWarp(
  targetVrt: URL,
  sourceVrt: URL,
  sourceProj: Epsg,
  opts?: gdalBuildVrtWarpOptions,
): GdalCommand {
  const command: GdalCommand = {
    output: targetVrt,
    command: 'gdalwarp',
    args: [
      ['-multi'], // Mutithread IO
      ['-of', 'vrt'], // Output as a VRT
      ['-wo', 'NUM_THREADS=ALL_CPUS'], // Multithread the warp
      ['-s_srs', sourceProj.toEpsgString()], // Source EPSG
      // ['-t_srs', Nztm2000QuadTms.projection.toEpsgString()], // Target EPSG
      // ['-tr', targetResolution, targetResolution],
    ]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };

  if (opts?.resamplingMethod != null) {
    command.args.push('-r', opts.resamplingMethod);
  }

  command.args.push(urlToString(sourceVrt), urlToString(targetVrt));

  return command;
}
