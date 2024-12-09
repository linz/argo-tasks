import { Bounds, Epsg } from '@basemaps/geo';
import { Tiff } from '@basemaps/shared';

export class TiffItem {
  readonly tiff: Tiff;
  readonly source: URL;
  readonly mapCode: string;
  readonly version: string;
  readonly bounds: Bounds;
  readonly epsg: Epsg;

  constructor(tiff: Tiff, source: URL, mapCode: string, version: string, bounds: Bounds, epsg: Epsg) {
    this.tiff = tiff;
    this.source = source;
    this.mapCode = mapCode;
    this.version = version;
    this.bounds = bounds;
    this.epsg = epsg;
  }

  toJSON(): string {
    return `${this.mapCode}_${this.version}`;
  }
}
