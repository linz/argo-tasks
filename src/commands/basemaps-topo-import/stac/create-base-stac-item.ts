import { Bounds, Nztm2000QuadTms, Projection } from '@basemaps/geo';
import { CliId } from '@basemaps/shared/build/cli/info.js';
import { Tiff } from '@cogeotiff/core';
import { StacItem } from 'stac-ts';
import { GeoJSONPolygon } from 'stac-ts/src/types/geojson.js';

import { logger } from '../../../log.js';

const projection = Projection.get(Nztm2000QuadTms);
const cliDate = new Date().toISOString();

/**
 * This function creates a base StacItem object based on the provided parameters.
 * @param id: The id of the StacItem
 * @example "CJ10" or "CJ10_v1-00"
 *
 * @param mapCode The map code of the map sheet
 * @example "CJ10"
 *
 * @param version The version of the map sheet
 * @example "v1-00"
 *
 * @param tiff TODO
 *
 * @param bounds TODO
 *
 * @returns
 */
export function createBaseStacItem(id: string, mapCode: string, version: string, tiff: Tiff, bounds: Bounds): StacItem {
  logger.info({ id }, 'createBaseStacItem()');
  const item: StacItem = {
    type: 'Feature',
    stac_version: '1.0.0',
    id: id,
    links: [
      { rel: 'self', href: `./${id}.json`, type: 'application/json' },
      { rel: 'collection', href: './collection.json', type: 'application/json' },
      { rel: 'parent', href: './collection.json', type: 'application/json' },
    ],
    assets: {
      source: {
        href: tiff.source.url.href,
        type: 'image/tiff; application=geotiff',
        roles: ['data'],
      },
    },
    stac_extensions: ['https://stac-extensions.github.io/file/v2.0.0/schema.json'],
    properties: {
      datetime: cliDate,
      map_code: mapCode, // e.g. "CJ10"
      version: version.replace('-', '.'), // convert from "v1-00" to "v1.00"
      'proj:epsg': projection.epsg.code,
    },
    geometry: projection.boundsToGeoJsonFeature(bounds).geometry as GeoJSONPolygon,
    bbox: projection.boundsToWgs84BoundingBox(bounds),
    collection: CliId,
  };

  return item;
}
