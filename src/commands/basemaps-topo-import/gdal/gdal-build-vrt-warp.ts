import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { Epsg } from '@basemaps/geo';

import { urlToString } from '../../common.js';

/**
 * Constructs a 'gdalwarp' GdalCommand.
 *
 * @param targetVrt
 * @param sourceVrt
 * @param sourceProj
 * @param opts
 * @returns
 */
export function gdalBuildVrtWarp(targetVrt: URL, sourceVrt: URL, sourceProj: Epsg): GdalCommand {
  const command: GdalCommand = {
    output: targetVrt,
    command: 'gdalwarp',
    args: [
      ['-multi'], // Mutithread IO
      ['-of', 'vrt'], // Output as a VRT
      ['-wo', 'NUM_THREADS=ALL_CPUS'], // Multithread the warp
      ['-s_srs', sourceProj.toEpsgString()], // Source EPSG

      urlToString(sourceVrt),
      urlToString(targetVrt),
    ]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };

  return command;
}
