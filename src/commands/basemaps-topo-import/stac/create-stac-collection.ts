import { Bounds } from '@basemaps/geo';
import { CliId } from '@basemaps/shared/build/cli/info.js';
import { StacCollection, StacItem } from 'stac-ts';

import { logger } from '../../../log.js';

const cliDate = new Date().toISOString();

export function createStacCollection(title: string, imageryBounds: Bounds, items: StacItem[]): StacCollection {
  logger.info({ items: items.length }, 'CreateStacCollection()');
  const collection: StacCollection = {
    type: 'Collection',
    stac_version: '1.0.0',
    id: CliId,
    title,
    description: 'Topographic maps of New Zealand',
    license: 'CC-BY-4.0',
    links: [
      // TODO: We not have an ODR bucket for the linz-topographic yet.
      // {
      //   rel: 'root',
      //   href: 'https://nz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
      //   type: 'application/json',
      // },
      { rel: 'self', href: './collection.json', type: 'application/json' },
      ...items.map((item) => {
        return {
          href: `./${item.id}.json`,
          rel: 'item',
          type: 'application/json',
          // 'file:checksum': stats['file:checksum'],
          // 'file:size': stats['file:size'],
        };
      }),
    ],
    providers: [{ name: 'Land Information New Zealand', roles: ['host', 'licensor', 'processor', 'producer'] }],
    'linz:lifecycle': 'ongoing',
    'linz:geospatial_category': 'topographic-maps',
    'linz:region': 'new-zealand',
    'linz:security_classification': 'unclassified',
    'linz:slug': 'topo50',
    extent: {
      spatial: { bbox: [imageryBounds.toBbox()] },
      // Default the temporal time today if no times were found as it is required for STAC
      temporal: { interval: [[cliDate, null]] },
    },
    stac_extensions: ['https://stac-extensions.github.io/file/v2.0.0/schema.json'],
  };

  return collection;
}
