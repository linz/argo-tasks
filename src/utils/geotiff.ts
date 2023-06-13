import { CogTiff, TiffTagGeo } from '@cogeotiff/core';
import { fsa } from '@chunkd/fs';

/**
 * Attempt to prase a tiff world file
 *
 * @example
 * ```
 * 0.075
 * 0
 * 0
 * -0.075
 * 1460800.0375
 * 5079479.9625
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

  const originX = Number(parts[4]);
  const originY = Number(parts[5]);
  if (Number.isNaN(originX) || Number.isNaN(originY)) throw new Error('TFW: Invalid origins: ' + data);
  return { scale: { x: scaleX, y: scaleY }, origin: { x: originX - scaleX / 2, y: originY - scaleY / 2 } };
}

/**
 * Is the geotiff set as PixelIsPoint mode
 *
 * @see {TiffTagGeo.GTRasterTypeGeoKey}
 **/
export const PixelIsPoint = 2;

/**
 * Attempt to find the bounding box for a tiff
 * Will read a sidecar `.tfw` if one exists
 *
 * @returns [minX, minY, maxX, maxY] bounding box
 */
export async function findBoundingBox(tiff: CogTiff): Promise<[number, number, number, number] | null> {
  const img = tiff.getImage(0);
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
  const tfwPath = tiff.source.uri.slice(0, tiff.source.uri.lastIndexOf('.')) + '.tfw';
  const tfwData = await fsa.read(tfwPath).catch(() => null);
  if (tfwData) {
    const tfw = parseTfw(String(tfwData));

    const x1 = tfw.origin.x;
    const y1 = tfw.origin.y;

    const x2 = x1 + tfw.scale.x * size.width;
    const y2 = y1 + tfw.scale.y * size.height;

    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }

  // Unable to find any bounding box
  return null;
}
