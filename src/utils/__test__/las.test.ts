import { fsa, FsMemory } from '@chunkd/fs';
import type { BBox } from '@linzjs/geojson';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import type { LasVlr } from '../las.ts';
import { lasCrs, readLasHeader } from '../las.ts';
import { fakeLasHeader, geoKeys } from './las.data.ts';

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

  it('should read the CRS of LAS 1.2 from GeoTIFF keys', async () => {
    const url = fsa.toUrl('memory://las/keys.las');
    await fsa.write(url, fakeLasHeader(bbox, { minor: 2, verticalDatum: 7839 }));
    const { epsg, verticalEpsg, verticalDatum } = await readLasHeader(url);
    assert.deepEqual([epsg, verticalEpsg, verticalDatum], [2193, 7839, 7839]);
  });

  it('should read the CRS of LAS 1.4 from an EVLR after another EVLR', async () => {
    const url = fsa.toUrl('memory://las/evlr.laz');
    await fsa.write(url, fakeLasHeader(bbox, { evlr: true }));
    const { epsg, verticalEpsg } = await readLasHeader(url);
    assert.deepEqual([epsg, verticalEpsg], [2193, 7839]);
  });

  it('should read the own EPSG code of WKT1 and WKT2 nodes only', () => {
    const vlrs = (wkt: string): LasVlr[] => [
      { userId: 'LASF_Projection', recordId: 2112, description: '', data: new TextEncoder().encode(wkt).buffer },
    ];
    const unit = 'UNIT["metre",1,AUTHORITY["EPSG","9001"]]';
    assert.deepEqual(lasCrs(vlrs(`COMPD_CS["",PROJCS["",${unit}],VERT_CS["",${unit}]]`)), {
      epsg: undefined,
      verticalEpsg: undefined,
      verticalDatum: undefined,
    });
    const wkt2 =
      'COMPOUNDCRS["",PROJCRS["",BASEGEOGCRS["",ID["EPSG",4167]],CONVERSION["",PARAMETER["",0,ID["EPSG",8801]]],ID["EPSG",2193]],' +
      'VERTCRS["",VDATUM["",ID["EPSG",1169]],ID["EPSG",7839]]]';
    assert.deepEqual(lasCrs(vlrs(wkt2)), { epsg: 2193, verticalEpsg: 7839, verticalDatum: 1169 });
    const long = wkt2.replace('PROJCRS', 'PROJECTEDCRS').replace('VERTCRS', 'VERTICALCRS').replace('VDATUM', 'VRF');
    assert.deepEqual(lasCrs(vlrs(long)), { epsg: 2193, verticalEpsg: 7839, verticalDatum: 1169 });
  });

  it('should ignore GeoKeys stored outside the directory', () => {
    const data = geoKeys([
      [3072, 2193],
      [4096, 0, 34736],
    ]).buffer as ArrayBuffer;
    assert.deepEqual(lasCrs([{ userId: 'LASF_Projection', recordId: 34735, description: '', data }]), {
      epsg: 2193,
      verticalEpsg: undefined,
      verticalDatum: undefined,
    });
  });

  it('should fail on a non LAS file', async () => {
    const url = fsa.toUrl('memory://las/c.laz');
    await fsa.write(url, Buffer.alloc(375));
    await assert.rejects(readLasHeader(url), /Not a LAS file: memory:\/\/las\/c.laz/);
  });
});
