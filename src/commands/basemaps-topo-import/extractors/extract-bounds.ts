import { Bounds } from '@basemaps/geo';
import { Tiff } from '@cogeotiff/core';

import { findBoundingBox } from '../../../utils/geotiff.js';

/**
 * This function attempts to extract bounds from the given Tiff object.
 *
 * @param tiff: The Tiff object from which to extract bounds
 *
 * @returns if succeeded, a Bounds object. Otherwise, null.
 */
export async function extractBounds(tiff: Tiff): Promise<Bounds | null> {
  try {
    return Bounds.fromBbox(await findBoundingBox(tiff));
  } catch (e) {
    return null;
  }
}
