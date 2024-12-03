import { Epsg } from '@basemaps/geo';
import { Tiff, TiffTagGeo } from '@cogeotiff/core';

import { logger } from '../../../log.js';
import { extractEpsg } from '../../generate-path/path.generate.js';

export function extractEpsgFromTiff(tiff: Tiff): Epsg | null {
  try {
    const epsg = Epsg.tryGet(extractEpsg(tiff));
    if (epsg != null) return epsg;
  } catch {
    logger.warn('Could not extract epsg code directly from tiff');
  }

  const tag = tiff.images[0]?.valueGeo(TiffTagGeo.ProjectedCitationGeoKey);

  if (tag?.startsWith('Universal Transverse Mercator Zone')) {
    return Epsg.Wgs84;
  }

  if (tag?.startsWith('Chatham Islands Transverse Mercator 2000')) {
    return Epsg.Citm2000;
  }

  if (tag?.startsWith('New Zealand Transverse Mercator 2000')) {
    return Epsg.Nztm2000;
  }

  return null;
}
