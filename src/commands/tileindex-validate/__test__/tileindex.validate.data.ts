import { TiffLocation } from '../tileindex.validate.js';
import { CogTiff } from '@cogeotiff/core';

const resolution = [1, -1, 0];
const size = { width: 480, height: 720 }
const valueGeo = () => undefined;

export const TiffAs21 = { source: { uri: 's3://test-as21' }, images: [{ origin: [1492000, 6234000], epsg: 2193, resolution, size, isGeoLocated: true, valueGeo }] } as unknown as CogTiff
export const TiffAy29 = { source: { uri: 's3://test-ay29' }, images: [{ origin: [1684000, 6018000], epsg: 2193, resolution, size, isGeoLocated: true, valueGeo }] } as unknown as CogTiff

export const TiffAs21In3857 = { source: { uri: 's3://test-as21-3857' }, images: [{ origin: [19128043.69337794, -4032710.6009459053], epsg: 3857, resolution, size, isGeoLocated: true, valueGeo }] } as unknown as CogTiff

export const InputCogTiff = [
  { source: { uri: 's3://test-path-one' }, images: [{ origin: [1492000, 6234000], epsg: 2193, resolution, size, isGeoLocated: true, valueGeo }] },
  { source: { uri: 's3://test-path-two' }, images: [{ origin: [1684000, 6018000], epsg: 2193, resolution, size, isGeoLocated: true, valueGeo}] },
] as unknown as CogTiff[];

export const DuplicateOutputCogTiff = [{ tileName: 'AS21_1000_0101', uris: ['s3://test-path-one', 's3://duplicate'] }];

export const DuplicateInput = [
  {
    bbox: [1255840, 4827840, 1256320, 4828560],
    source: 's3://test-path-one',
    tileName: 'CH11_5000_0102',
    epsg: 2193
  },
  {
    bbox: [1257760, 4828560, 1258240, 4829280],
    source: 's3://test-path-two',
    tileName: 'CH11_5000_0103',
    epsg: 2193
  },
  {
    bbox: [1256320, 4827840, 1256800, 4828560],
    source: 's3://duplicate',
    tileName: 'CH11_5000_0102',
    epsg: 2193
  }
] as unknown as TiffLocation[];

export const DuplicateOutput = new Map(
  [
    ['CH11_5000_0102', [
      {
        bbox: [Array],
        source: 's3://test-path-one',
        tileName: 'CH11_5000_0102',
        epsg: 2193
      },
      {
        bbox: [Array],
        source: 's3://duplicate',
        tileName: 'CH11_5000_0102',
        epsg: 2193
      }
    ]
  ],
    ['CH11_5000_0103', [
      {
        bbox: [Array],
        source: 's3://test-path-two',
        tileName: 'CH11_5000_0103',
        epsg: 2193
      }
    ]]
  ]) as unknown as Map<string, TiffLocation[]>;

  // const features = [
//   // Top left of all
//   'CH11_1000_0101',
//   'CH11_1000_0102',

//   // Three points of 1:5k
//   'CH11_1000_0105',
//   'CH11_1000_0501',
//   'CH11_1000_0505',

//   // Three points of 1:10k
//   'CH11_1000_0110',
//   'CH11_1000_1001',
//   'CH11_1000_1010',

//   // Outside our bounds
//   'CH11_1000_1111',
//   // Bigger tiles
//   'CH11_5000_0101',
//   'CH11_10000_0101'
// ].map(f => {
//   const extract = MapSheet.extract(f)