import { MapSheet } from '../../../utils/mapsheet.js';
import { CogTiff, CogTiffImage, Size } from '@cogeotiff/core';

const resolution = [1, -1, 0];
const size = { width: 480, height: 720 }
const valueGeo = () => undefined;

const DefaultTiffImage = {
  origin: [1492000, 6234000], epsg: 2193, resolution, size, isGeoLocated: true 
}

export interface FakeCogTiffImage extends CogTiffImage {
  epsg: number;
  origin: [number, number, number]
}

export class FakeCogTiff extends CogTiff {
  override images: [FakeCogTiffImage, ...FakeCogTiffImage[]];

  constructor(uri: string, image: Partial<{ origin: number[], epsg: number, resolution: number[], size: Size, isGeoLocated: boolean }> ) {
    super({ uri } as any)
    this.images = [{...structuredClone(DefaultTiffImage), valueGeo ,...image} as any]
  }

  static fromTileName(tileName: string): FakeCogTiff {
    const extract = MapSheet.extract(tileName)
    if (extract == null) throw new Error('invalid tile name: ' +tileName)

    return new FakeCogTiff(`s3://path/${tileName}.tiff`, { origin: [extract.origin.x, extract.origin.y], size: { width: extract.width, height: extract.height }, epsg: 2193})
  }
}
