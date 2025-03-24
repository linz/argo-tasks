import type { StacCollection } from 'stac-ts';

import type { StacCollectionLinz } from '../../../utils/metadata.ts';

export const SampleCollection: StacCollection & StacCollectionLinz = {
  type: 'Collection',
  stac_version: '1.0.0',
  id: '01J0Q2CCGQKXK0TSBEJ4HRKR2X',
  title: 'Palmerston North 0.3m Urban Aerial Photos (2024)',
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
