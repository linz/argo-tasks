import assert from 'node:assert';
import { describe, it } from 'node:test';

import { ConfigImagery, ConfigProviderMemory, ConfigTileSet } from '@basemaps/config';
import { FeatureCollection } from 'geojson';

import { createMapSheet } from '../create-mapsheet.js';

describe('copyFiles', () => {
  const rest: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [1156000, 4758000],
                [1180000, 4758000],
                [1180000, 4722000],
                [1156000, 4722000],
                [1156000, 4758000],
              ],
            ],
          ],
        },
        properties: { sheet_code_id: 'CK07', topo50_coverage: 'Partial' },
      },
    ],
  };

  const aerial: ConfigTileSet = {
    id: 'ts_aerial',
    description: 'aerial basemap',
    layers: [
      {
        '2193': 'im_01G73E4AMSQ91TXQ3KC90NNPA0',
        '3857': 'im_01G73E5DZKE9NSW6E41QQRT28T',
        name: 'nz-satellite-2021-2022-10m',
        title: 'New Zealand 10m Satellite Imagery (2021-2022)',
        category: 'Satellite Imagery',
      },
      {
        '2193': 'im_01F6P1S7DSP4N5DCBGCTZCMJ27',
        '3857': 'im_01ED835ZSP0MQ3W55QEMVZKNR1',
        name: 'southland-rural-2005-2011-0.75m',
        title: 'Southland 0.75m Rural Aerial Photos (2005-2011)',
        category: 'Rural Aerial Photos',
        minZoom: 13,
      },
    ],
  } as ConfigTileSet;

  const satellite: ConfigImagery = {
    id: 'im_01G73E4AMSQ91TXQ3KC90NNPA0',
    name: 'nz-satellite-2021-2022-10m',
    title: 'New Zealand 10m Satellite Imagery (2021-2022)',
    projection: 2193,
    tileMatrix: 'NZTM2000Quad',
    uri: 's3://linz-basemaps/2193/nz_satellite_2021-2022_10m_RGB/01G73E4AMSQ91TXQ3KC90NNPA0',
    bounds: {
      x: 1044346.7046211124,
      y: 4646097.909862504,
      width: 1330615.7883883435,
      height: 1604566.0977624143,
    },
    files: [
      // Intersection
      {
        x: 1122618.2215851326,
        y: 4646097.909862504,
        width: 156543.03392804044,
        height: 156543.03392804044,
        name: '6-28-36.tiff',
      },
      // No Intersection
      {
        x: 1748790.3572972943,
        y: 5428813.079502706,
        width: 626172.1357121618,
        height: 626172.1357121618,
        name: '4-8-7.tiff',
      },
    ],
  };

  const southland: ConfigImagery = {
    id: 'im_01F6P1S7DSP4N5DCBGCTZCMJ27',
    name: 'southland-rural-2005-2011-0.75m',
    title: 'Southland 0.75m Rural Aerial Photos (2005-2011)',
    projection: 2193,
    tileMatrix: 'NZTM2000Quad',
    uri: 's3://linz-basemaps/2193/southland_rural_2005-2011_0-75m_RGBA/01F6P1S7DSP4N5DCBGCTZCMJ27',
    bounds: {
      x: 1083482.4631031225,
      y: 4724369.426826525,
      width: 234814.55089206062,
      height: 391357.58482010104,
    },
    files: [
      // Intersection
      {
        x: 1161753.9800671428,
        y: 4724369.426826525,
        width: 39135.75848201011,
        height: 39135.75848201011,
        name: '8-113-145.tiff',
      },
      // No Intersection
      {
        x: 1161753.9800671428,
        y: 4841776.702272555,
        width: 39135.75848201011,
        height: 39135.75848201011,
        name: '8-113-142.tiff',
      },
    ],
  };
  const mem = new ConfigProviderMemory();
  mem.put(aerial);
  mem.put(satellite);
  mem.put(southland);

  it('Should create the correct map sheets', async () => {
    const outputs = await createMapSheet(aerial, mem, rest, undefined, undefined);

    assert.deepEqual(outputs, [
      {
        sheetCode: 'CK07',
        files: [
          's3://linz-basemaps/2193/nz_satellite_2021-2022_10m_RGB/01G73E4AMSQ91TXQ3KC90NNPA0/6-28-36.tiff',
          's3://linz-basemaps/2193/southland_rural_2005-2011_0-75m_RGBA/01F6P1S7DSP4N5DCBGCTZCMJ27/8-113-145.tiff',
        ],
      },
    ]);
  });

  it('Should exclude the satellite', async () => {
    const outputs = await createMapSheet(aerial, mem, rest, undefined, new RegExp('satellite', 'i'));

    assert.deepEqual(outputs, [
      {
        sheetCode: 'CK07',
        files: [
          's3://linz-basemaps/2193/southland_rural_2005-2011_0-75m_RGBA/01F6P1S7DSP4N5DCBGCTZCMJ27/8-113-145.tiff',
        ],
      },
    ]);
  });
});
