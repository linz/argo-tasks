import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { Epsg } from '@basemaps/geo';

import { urlToString } from '../common.js';

export function gdalBuildVrt(targetVrt: URL, source: URL[]): GdalCommand {
  if (source.length === 0) throw new Error('No source files given for :' + targetVrt.href);
  return {
    output: targetVrt,
    command: 'gdalbuildvrt',
    args: [['-addalpha'], urlToString(targetVrt), ...source.map(urlToString)]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };
}

export function gdalBuildVrtWarp(targetVrt: URL, sourceVrt: URL, sourceProj: Epsg): GdalCommand {
  return {
    output: targetVrt,
    command: 'gdalwarp',
    args: [
      ['-multi'], // Mutithread IO
      ['-of', 'vrt'], // Output as a VRT
      ['-wo', 'NUM_THREADS=ALL_CPUS'], // Multithread the warp
      ['-s_srs', sourceProj.toEpsgString()], // Source EPSG
      // ['-t_srs', Nztm2000QuadTms.projection.toEpsgString()], // Target EPSG
      // ['-tr', targetResolution, targetResolution],
      urlToString(sourceVrt),
      urlToString(targetVrt),
    ]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };
}

export function gdalBuildCogCommands(input: URL, output: URL): GdalCommand {
  return {
    output,
    command: 'gdal_translate',
    args: [
      ['-q'], // Supress non-error output
      ['-stats'], // Force stats (re)computation
      ['-of', 'COG'], // Output format

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
}
