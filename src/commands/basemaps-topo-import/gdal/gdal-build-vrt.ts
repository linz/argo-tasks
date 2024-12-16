import { GdalCommand } from '@basemaps/cogify/build/cogify/gdal.runner.js';

import { urlToString } from '../../common.js';

/**
 * Constructs a 'gdalBuildVrt' GdalCommand.
 *
 * @param targetVrt
 * @param source
 * @param opts
 * @returns
 */
export function gdalBuildVrt(targetVrt: URL, source: URL[]): GdalCommand {
  if (source.length === 0) throw new Error('No source files given for :' + targetVrt.href);

  const command: GdalCommand = {
    output: targetVrt,
    command: 'gdalbuildvrt',
    args: ['-addalpha', urlToString(targetVrt), ...source.map(urlToString)],
  };

  return command;
}
