import { fsa } from '@chunkd/fs';
import type { Tiff } from '@cogeotiff/core';
import { RasterTypeKey, TiffTagGeo } from '@cogeotiff/core';

import { replaceUrlPathPattern } from '../commands/common.ts';
import { protocolAwareString } from './filelist.ts';

/**
 * Type for parsed TFW values
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
 */
export type TfwParseResult = {
  scale: { x: number; y: number };
  origin: { x: number; y: number };
};

/**
 * Attempt to load a tiff world file and return parsed values
 *
 *
 * @param imageLoc Location of TIFF file
 * @returns
 */
export async function loadTfw(imageLoc: URL): Promise<TfwParseResult> {
  // Attempt to read a TFW next to the tiff
  const baseLocation = replaceUrlPathPattern(imageLoc, new RegExp('\\.tiff?$', 'i'));

  const tfwVariants = ['.tfw', '.TFW', '.Tfw']; // add more if needed
  let tfwData;
  for (const tfwExtension of tfwVariants) {
    const candidateTfwLocation = fsa.toUrl(baseLocation.href + tfwExtension);
    try {
      tfwData = await fsa.read(candidateTfwLocation);
      break;
    } catch (err) {}
  }

  if (!tfwData) {
    throw new Error('No matching TFW variant found.');
  }

  return parseTfw(String(tfwData));
}

/**
 * Attempt to parse a tiff world file
 *
 *
 * @param data Raw TFW file
 * @returns
 */
export function parseTfw(data: string): TfwParseResult {
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
  if (img == null) {
    throw new Error(
      `Failed to find bounding box/origin - no images found in file: ${protocolAwareString(tiff.source.url)}`,
    );
  }
  const size = img.size;

  // If the tiff has geolocation information just read it from the tiff
  if (img.isGeoLocated) {
    const origin = img.origin;
    const resolution = img.resolution;
    let x1 = origin[0];
    let y1 = origin[1];

    // Tiff value is a point so everything is offset by 1/2 a pixel
    if (img.valueGeo(TiffTagGeo.GTRasterTypeGeoKey) === RasterTypeKey.PixelIsPoint) {
      x1 = x1 - resolution[0] / 2;
      y1 = y1 - resolution[1] / 2;
    }

    const x2 = x1 + resolution[0] * size.width;
    const y2 = y1 + resolution[1] * size.height;
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }
  const tfw = await loadTfw(tiff.source.url);

  const x1 = tfw.origin.x;
  const y1 = tfw.origin.y;

  const x2 = x1 + tfw.scale.x * size.width;
  const y2 = y1 + tfw.scale.y * size.height;

  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

/**
 * Attempt to find the resolution for a tiff
 *
 * Will attempt to read a sidecar `.tfw` if the tiff does not contain the resolution
 *
 * @returns resolution
 */
export async function findResolution(tiff: Tiff): Promise<number> {
  const img = tiff.images[0];
  if (img == null) {
    throw new Error(`Failed to find GSD - no images found in file: ${protocolAwareString(tiff.source.url)}`);
  }
  let resolution: number;
  if (img.isGeoLocated) {
    resolution = img.resolution[0];
    return resolution;
  }
  const tfw = await loadTfw(tiff.source.url);
  if (tfw.scale.x === tfw.scale.y) {
    resolution = tfw.scale.x;
  } else {
    throw new Error('X and Y resolutions in TFW sidecar file do not match.');
  }
  return resolution;
}
