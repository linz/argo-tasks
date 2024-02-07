import { Size, Tiff, TiffImage } from '@cogeotiff/core';

import { MapSheet } from '../../../utils/mapsheet.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const resolution = [1, -1, 0];
const size = { width: 480, height: 720 };
const valueGeo = (): undefined => undefined;

const DefaultTiffImage = {
  origin: [1492000, 6234000],
  epsg: 2193,
  resolution,
  size,
  isGeoLocated: true,
};

export interface FakeTiffImage extends TiffImage {
  epsg: number;
  origin: [number, number, number];
}

export class FakeTiff extends Tiff {
  override images: [FakeTiffImage, ...FakeTiffImage[]];

  constructor(
    uri: URL,
    image: Partial<{ origin: number[]; epsg: number; resolution: number[]; size: Size; isGeoLocated: boolean }>,
  ) {
    super({ url: uri } as any);
    this.images = [{ ...structuredClone(DefaultTiffImage), valueGeo, ...image } as any];
  }

  static fromTileName(tileName: string): FakeTiff {
    const mapTileIndex = MapSheet.getMapTileIndex(tileName);
    if (mapTileIndex == null) throw new Error('invalid tile name: ' + tileName);

    return new FakeTiff(new URL(`s3://path/${tileName}.tiff`), {
      origin: [mapTileIndex.origin.x, mapTileIndex.origin.y],
      size: { width: mapTileIndex.width, height: mapTileIndex.height },
      epsg: 2193,
    });
  }
}
