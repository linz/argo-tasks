import { fsa } from '@chunkd/fs';
import { Tiff, TiffTagGeo } from '@cogeotiff/core';

import { urlToString } from '../commands/common.js';

/**
 * Attempt to parse a tiff world file
 *
 * https://en.wikipedia.org/wiki/World_file
 *
 * @example
 * ```
 * 0.075        // X Scale
 * 0            // Y Rotation
 * 0            // X Rotation
 * -0.075       // Y Scale (Must be negative)
 * 1460800.0375 // X Offset of center of top left pixel
 * 5079479.9625 // Y offset of center of top left pixel
 * ```
 *
 * @param data Raw TFW file
 * @returns
 */
export function parseTfw(data: string): { scale: { x: number; y: number }; origin: { x: number; y: number } } {
  const parts = data.split('\n');
  if (parts.length < 6) throw new Error('TFW: Not enough points');
  const scaleX = Number(parts[0]);
  const scaleY = Number(parts[3]);
  if (Number.isNaN(scaleX) || Number.isNaN(scaleY)) throw new Error('TFW: Invalid scales: ' + data);

  const rotationX = Number(parts[1]);
  const rotationY = Number(parts[2]);
  if (rotationX !== 0 || rotationY !== 0) throw new Error('TFW: Rotation must be zero');

  const originX = Number(parts[4]);
  const originY = Number(parts[5]);
  if (Number.isNaN(originX) || Number.isNaN(originY)) throw new Error('TFW: Invalid origins: ' + data);
  return { scale: { x: scaleX, y: scaleY }, origin: { x: originX - scaleX / 2, y: originY - scaleY / 2 } };
}

/**
 * Is the geotiff set as PixelIsPoint mode which offsets the origin of Tiff
 *
 * @see {TiffTagGeo.GTRasterTypeGeoKey}
 **/
export const PixelIsPoint = 2;

/**
 * Attempt to find the bounding box for a tiff
 *
 * Will attempt to read a sidecar `.tfw` if the tiff does not contain the origin.
 *
 * @returns [minX, minY, maxX, maxY] bounding box
 */
export async function findBoundingBox(tiff: Tiff): Promise<[number, number, number, number]> {
  const img = tiff.images[0];
  if (img == null) throw new Error(`Failed to find bounding box/origin - no images found in file: ${tiff.source.url}`);
  const size = img.size;

  // If the tiff has geo location information just read it from the tiff
  if (img.isGeoLocated) {
    const origin = img.origin;
    const resolution = img.resolution;
    let x1 = origin[0];
    let y1 = origin[1];

    // Tiff value is a point so everything is offset by 1/2 a pixel
    if (img.valueGeo(TiffTagGeo.GTRasterTypeGeoKey) === PixelIsPoint) {
      x1 = x1 - resolution[0] / 2;
      y1 = y1 - resolution[1] / 2;
    }

    const x2 = x1 + resolution[0] * size.width;
    const y2 = y1 + resolution[1] * size.height;
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }

  // Attempt to read a TFW next to the tiff
  const sourcePath = urlToString(tiff.source.url);
  const tfwPath = sourcePath.slice(0, sourcePath.lastIndexOf('.')) + '.tfw';
  const tfwData = await fsa.read(new URL(`file://${tfwPath}`));
  const tfw = parseTfw(String(tfwData));

  const x1 = tfw.origin.x;
  const y1 = tfw.origin.y;

  const x2 = x1 + tfw.scale.x * size.width;
  const y2 = y1 + tfw.scale.y * size.height;

  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}
