import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';
import { Epsg, Nztm2000QuadTms, Projection } from '@basemaps/geo';

import { urlToString } from '../common.js';

export function gdalBuildVrt(targetVrt: URL, source: URL[]): GdalCommand {
  if (source.length === 0) throw new Error('No source files given for :' + targetVrt.href);
  return {
    output: targetVrt,
    command: 'gdalbuildvrt',
    args: ['-addalpha', urlToString(targetVrt), ...source.map(urlToString)],
  };
}

export function gdalBuildVrtWarp(
  targetVrt: URL,
  sourceVrt: URL,
  sourceProj: Epsg,
  sourceRes: [number, number, number],
): GdalCommand {
  const resZoom = Projection.getTiffResZoom(Nztm2000QuadTms, sourceRes[0]);
  const targetResolution = Nztm2000QuadTms.pixelScale(resZoom);
  return {
    output: targetVrt,
    command: 'gdalwarp',
    args: [
      ['-of', 'vrt'], // Output as a VRT
      '-multi', // Mutithread IO
      ['-wo', 'NUM_THREADS=ALL_CPUS'], // Multithread the warp
      ['-s_srs', sourceProj.toEpsgString()], // Source EPSG
      ['-t_srs', Nztm2000QuadTms.projection.toEpsgString()], // Target EPSG
      ['-tr', targetResolution, targetResolution],
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
    command: 'gdal_translate',
    output,
    args: [
      ['-q'], // Supress non-error output
      ['-of', 'COG'], // Output format
      ['-stats'], // Force stats (re)computation
      ['-a_srs', Nztm2000QuadTms.projection.toEpsgString()], // Projection override
      ['-co', 'ADD_ALPHA=YES'],
      ['-co', 'NUM_THREADS=ALL_CPUS'], // Use all CPUS
      ['-co', 'SPARSE_OK=TRUE'], // Allow for sparse writes
      ['-co', 'BIGTIFF=NO'],
      ['-co', 'OVERVIEWS=IGNORE_EXISTING'],
      ['-co', `BLOCKSIZE=512`],
      ['-co', `COMPRESS=webp`],
      ['-co', `QUALITY=100`],
      ['-co', `OVERVIEW_COMPRESS=webp`],
      ['-co', `OVERVIEW_RESAMPLING=lanczos`],
      ['-co', `OVERVIEW_QUALITY=90`],
      urlToString(input),
      urlToString(output),
    ]
      .filter((f) => f != null)
      .flat()
      .map(String),
  };
}
