import { StacCollection } from 'stac-ts';

import { StacCollectionLinz } from '../../common.js';

export const SampleCollectionUrbanImagery: StacCollection & StacCollectionLinz = {
  type: 'Collection',
  stac_version: '1.0.0',
  id: '01J0Q2CCGQKXK0TSBEJ4HRKR2X',
  title: 'Palmerston North 0.1m Urban Aerial Photos (2024)',
  description: 'Orthophotography within the Manawatū-Whanganui region captured in the 2024 flying season.',
  license: 'CC-BY-4.0',
  links: [
    { rel: 'self', href: './collection.json', type: 'application/json' },
    {
      rel: 'item',
      href: './BM34_1000_3040.json',
      type: 'application/json',
    },
    {
      rel: 'item',
      href: './BM34_1000_3041.json',
      type: 'application/json',
    },
  ],
  providers: [
    { name: 'Aerial Surveys', roles: ['producer'] },
    { name: 'Palmerston North City Council', roles: ['licensor'] },
    {
      name: 'Toitū Te Whenua Land Information New Zealand',
      roles: ['host', 'processor'],
    },
  ],
  'linz:lifecycle': 'completed',
  'linz:geospatial_category': 'urban-aerial-photos',
  'linz:region': 'manawatu-whanganui',
  'linz:slug': 'palmerston-north_2024_0.3m',
  'linz:security_classification': 'unclassified',
  'linz:geographic_description': 'Palmerston North',
  extent: {
    spatial: {
      bbox: [[175.4961876, -36.8000575, 175.5071491, -36.7933469]],
    },
    temporal: {
      interval: [['2024-02-14T11:00:00Z', '2024-04-28T12:00:00Z']],
    },
  },
};

export const SampleCollectionDem: StacCollection & StacCollectionLinz = {
  type: 'Collection',
  stac_version: '1.0.0',
  id: '01HQRJ3ZRPRD0NY2406V2C47MR',
  title: 'Southland LiDAR 1m DEM (2020-2024)',
  description: 'Digital Elevation Model within the Southland region captured in 2020-2024.',
  license: 'CC-BY-4.0',
  links: [
    { rel: 'self', href: './collection.json', type: 'application/json' },
    {
      rel: 'item',
      href: './CG10_10000_0202.json',
      type: 'application/json',
    },
    {
      rel: 'item',
      href: './CG10_10000_0203.json',
      type: 'application/json',
    },
  ],
  providers: [
    { name: 'Aerial Surveys', roles: ['producer'] },
    { name: 'Environment Southland', roles: ['licensor'] },
    {
      name: 'Toitū Te Whenua Land Information New Zealand',
      roles: ['host', 'processor'],
    },
  ],
  'linz:lifecycle': 'completed',
  'linz:geospatial_category': 'dem',
  'linz:region': 'southland',
  'linz:slug': 'southland_2020-2023',
  'linz:security_classification': 'unclassified',
  extent: {
    spatial: {
      bbox: [[175.4961876, -36.8000575, 175.5071491, -36.7933469]],
    },
    temporal: {
      interval: [['2020-12-14T11:00:00Z', '2024-01-29T11:00:00Z']],
    },
  },
};
