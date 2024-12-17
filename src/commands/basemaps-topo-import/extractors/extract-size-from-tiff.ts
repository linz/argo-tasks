import { Size } from '@basemaps/geo';
import { Tiff } from '@cogeotiff/core';

import { logger } from '../../../log.js';

/**
 *  Attempts to extract a size from the given Tiff object.
 *
 * @param tiff: The Tiff object from which to extract the size
 *
 * @returns if succeeded, a Size object. Otherwise, null.
 */
export function extractSizeFromTiff(tiff: Tiff): Size | null {
  try {
    const size = tiff.images[0]?.size ?? null;

    logger.info({ found: true }, 'extractSizeFromTiff()');
    return size;
  } catch (e) {
    logger.info({ found: false }, 'extractSizeFromTiff()');
    return null;
  }
}
