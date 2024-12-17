import { CliId } from '@basemaps/shared/build/cli/info.js';
import { GeoJSONPolygon } from 'stac-ts/src/types/geojson.js';

import { logger } from '../../../log.js';
import { MapSheetStacItem } from '../types/map-sheet-stac-item.js';
import { TiffItem } from '../types/tiff-item.js';

const cliDate = new Date().toISOString();

/**
 * This function creates a base StacItem object based on the provided parameters.
 *
 * @param fileName: The map sheet's filename
 * @example "CJ10" or "CJ10_v1-00"
 *
 * @param tiffItem TODO
 *
 * @returns a StacItem object
 */
export function createBaseStacItem(fileName: string, tiffItem: TiffItem): MapSheetStacItem {
  logger.info({ fileName }, 'createBaseStacItem()');

  const item: MapSheetStacItem = {
    type: 'Feature',
    stac_version: '1.0.0',
    id: fileName,
    links: [
      { rel: 'self', href: `./${fileName}.json`, type: 'application/json' },
      { rel: 'collection', href: './collection.json', type: 'application/json' },
      { rel: 'parent', href: './collection.json', type: 'application/json' },
    ],
    assets: {
      source: {
        href: tiffItem.source.href,
        type: 'image/tiff; application=geotiff',
        roles: ['data'],
      },
    },
    stac_extensions: ['https://stac-extensions.github.io/file/v2.0.0/schema.json'],
    properties: {
      datetime: cliDate,
      map_code: tiffItem.mapCode,
      version: tiffItem.version.replace('-', '.'), // e.g. "v1-00" to "v1.00"
      'proj:epsg': tiffItem.epsg.code,
      'source.width': tiffItem.size.width,
      'source.height': tiffItem.size.height,
    },
    geometry: { type: 'Polygon', coordinates: tiffItem.bounds.toPolygon() } as GeoJSONPolygon,
    bbox: tiffItem.bounds.toBbox(),
    collection: CliId,
  };

  return item;
}
