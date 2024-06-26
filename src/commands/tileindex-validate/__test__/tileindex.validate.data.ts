import { Size, Source, Tiff, TiffImage } from '@cogeotiff/core';

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

export interface FakeCogTiffImage extends TiffImage {
  epsg: number;
  origin: [number, number, number];
}

export class FakeCogTiff extends Tiff {
  override images: [FakeCogTiffImage, ...FakeCogTiffImage[]];

  constructor(
    uri: string,
    image: Partial<{ origin: number[]; epsg: number; resolution: number[]; size: Size; isGeoLocated: boolean }>,
  ) {
    super({ url: new URL(uri) } as Source);
    this.images = [{ ...structuredClone(DefaultTiffImage), valueGeo, ...image } as any];
  }

  static fromTileName(tileName: string): FakeCogTiff {
    const mapTileIndex = MapSheet.getMapTileIndex(tileName);
    if (mapTileIndex == null) throw new Error('invalid tile name: ' + tileName);

    return new FakeCogTiff(`s3://path/${tileName}.tiff`, {
      origin: [mapTileIndex.origin.x, mapTileIndex.origin.y],
      size: { width: mapTileIndex.width, height: mapTileIndex.height },
      epsg: 2193,
    });
  }
}
