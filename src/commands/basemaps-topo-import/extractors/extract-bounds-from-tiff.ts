import { Bounds } from '@basemaps/geo';
import { Tiff } from '@cogeotiff/core';

import { logger } from '../../../log.js';
import { findBoundingBox } from '../../../utils/geotiff.js';

/**
 * Attempts to extract bounds from the given Tiff object.
 *
 * @param tiff: The Tiff object from which to extract bounds
 *
 * @returns if succeeded, a Bounds object. Otherwise, null.
 */
export async function extractBoundsFromTiff(tiff: Tiff): Promise<Bounds | null> {
  try {
    const bounds = Bounds.fromBbox(await findBoundingBox(tiff));

    logger.info({ found: true }, 'extractBoundsFromTiff()');
    return bounds;
  } catch (e) {
    logger.info({ found: false }, 'extractBoundsFromTiff()');
    return null;
  }
}
