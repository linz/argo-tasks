import { fsa, FsMemory } from '@chunkd/fs';
import type { BBox } from '@linzjs/geojson';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import { lasCrs, readLasHeader } from '../las.ts';
import { fakeLasHeader } from './las.data.ts';

describe('readLasHeader', () => {
  const bbox: BBox = [1_570_000, 5_180_000, 1_570_480, 5_180_720];
  before(() => fsa.register('memory://las/', new FsMemory()));

  it('should read a LAS 1.4 LAZ header', async () => {
    const url = fsa.toUrl('memory://las/a.laz');
    await fsa.write(url, fakeLasHeader(bbox, { pointFormat: 0x86, count: 5_000_000_000 }));
    const { source, ...header } = await readLasHeader(url);
    assert.equal(source, url);
    assert.deepEqual(header, {
      version: '1.4',
      pointFormat: 6,
      pointCount: 5_000_000_000,
      scale: [0.001, 0.001, 0.001],
      bbox,
      epsg: 2193,
      verticalEpsg: 7839,
      verticalDatum: 1169,
    });
  });

  it('should read the legacy point count of LAS 1.2', async () => {
    const url = fsa.toUrl('memory://las/b.las');
    await fsa.write(url, fakeLasHeader(bbox, { minor: 2, pointFormat: 1, count: 42 }));
    const header = await readLasHeader(url);
    assert.equal(header.pointCount, 42);
    assert.equal(header.pointFormat, 1);
  });

  it('should read the CRS from GeoTIFF keys', () => {
    const keys: [number, number][] = [
      [3072, 2193],
      [4096, 7839],
      [4098, 7839],
    ];
    const view = new DataView(new ArrayBuffer(8 + keys.length * 8));
    view.setUint16(6, keys.length, true);
    keys.forEach(([id, value], i) => {
      view.setUint16(8 + i * 8, id, true);
      view.setUint16(14 + i * 8, value, true);
    });
    const vlr = { userId: 'LASF_Projection', recordId: 34735, description: '', data: view.buffer };
    assert.deepEqual(lasCrs([vlr]), { epsg: 2193, verticalEpsg: 7839, verticalDatum: 7839 });
  });

  it('should fail on a non LAS file', async () => {
    const url = fsa.toUrl('memory://las/c.laz');
    await fsa.write(url, Buffer.alloc(375));
    await assert.rejects(readLasHeader(url), /Not a LAS file: memory:\/\/las\/c.laz/);
  });
});
