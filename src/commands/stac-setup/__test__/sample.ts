import type { StacCollection } from 'stac-ts';

import type { StacCollectionLinz } from '../../../utils/metadata.ts';

export const SampleCollection: StacCollection & StacCollectionLinz = {
  type: 'Collection',
  stac_version: '1.0.0',
  id: '01HGF4RAQSM53Z26Y7C27T1GMB',
  title: 'Palmerston North 0.3m Storm Satellite Imagery (2024) - Preview',
  description:
    'Satellite imagery within the Manawatū-Whanganui region captured in 2024, published as a record of the Storm event.',
  license: 'CC-BY-4.0',
  links: [
    { rel: 'self', href: './collection.json', type: 'application/json' },
    {
      rel: 'item',
      href: './BA34_1000_3040.json',
      type: 'application/json',
    },
    {
      rel: 'item',
      href: './BA34_1000_3041.json',
      type: 'application/json',
    },
  ],
  providers: [
    { name: 'Aerial Surveys', roles: ['producer'] },
    { name: 'Aerial Surveys', roles: ['licensor'] },
    {
      name: 'Toitū Te Whenua Land Information New Zealand',
      roles: ['host', 'processor'],
    },
  ],
  'linz:lifecycle': 'preview',
  'linz:geospatial_category': 'urban-aerial-photos',
  'linz:region': 'manawatu-whanganui',
  'linz:security_classification': 'unclassified',
  'linz:event_name': 'Storm',
  'linz:geographic_description': 'Palmerston North',
  'linz:slug': 'palmerston-north_2024_0.3m',
  extent: {
    spatial: {
      bbox: [[175.4961876, -36.8000575, 175.5071491, -36.7933469]],
    },
    temporal: {
      interval: [['2022-12-31T11:00:00Z', '2022-12-31T11:00:00Z']],
    },
  },
};
