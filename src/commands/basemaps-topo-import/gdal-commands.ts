import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';

import { urlToString } from '../common.js';

export function gdalBuildCogCommands(input: URL, output: URL): GdalCommand {
  return {
    command: 'gdal_translate',
    output,
    args: [
      ['-q'], // Supress non-error output
      ['-of', 'COG'], // Output format
      ['-stats'], // Force stats (re)computation
      ['-a_srs', `EPSG:2193`], // Projection override
      // creation options (-co)
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