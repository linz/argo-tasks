import { Epsg } from '@basemaps/geo';
import { Tiff, TiffTagGeo } from '@cogeotiff/core';

import { logger } from '../../../log.js';
import { extractEpsg } from '../../generate-path/path.generate.js';

const projections = [
  ['Universal Transverse Mercator Zone', Epsg.Wgs84],
  ['Chatham Islands Transverse Mercator 2000', Epsg.Citm2000],
  ['New Zealand Transverse Mercator 2000', Epsg.Nztm2000],
] as const;

export function extractEpsgFromTiff(tiff: Tiff): Epsg | null {
  // try to extract the epsg directly from the tiff
  try {
    const epsg = Epsg.get(extractEpsg(tiff));
    if (epsg != null) {
      logger.info({ found: epsg.code }, 'extractEpsgFromTiff()');
      return epsg;
    }
  } catch {
    // try to extract the epsg from the tiff's projected citation geotag
    const tag = tiff.images[0]?.valueGeo(TiffTagGeo.ProjectedCitationGeoKey);

    for (const [citation, epsg] of projections) {
      if (tag?.startsWith(citation)) {
        logger.info({ found: epsg.code }, 'extractEpsgFromTiff()');
        return epsg;
      }
    }
  }

  logger.info({ found: false }, 'extractEpsgFromTiff()');
  return null;
}
