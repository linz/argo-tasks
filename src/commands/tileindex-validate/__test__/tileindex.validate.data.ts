import { CogTiff } from '@cogeotiff/core';

export const DuplicateInput = [
  { source: { uri: 's3://test-path-one' }, images: [{ origin: [1492000, 6234000], epsg: 2193 }] },
  { source: { uri: 's3://test-path-two' }, images: [{ origin: [1684000, 6018000], epsg: 2193 }] },
  { source: { uri: 's3://duplicate' }, images: [{ origin: [1492000, 6234000], epsg: 2193 }] },
] as unknown as CogTiff[];

export const DuplicateOutput = [{ tileName: 'AS21_1000_0101', uris: ['s3://test-path-one', 's3://duplicate'] }];

export const NoDuplicateInput = [
  { source: { uri: 's3://test-path-one' }, images: [{ origin: [1492000, 6234000], epsg: 2193 }] },
  { source: { uri: 's3://test-path-two' }, images: [{ origin: [1684000, 6018000], epsg: 2193 }] },
  { source: { uri: 's3://test-path-three' }, images: [{ origin: [1732000, 5766000], epsg: 2193 }] },
] as unknown as CogTiff[];
