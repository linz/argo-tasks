import assert from 'node:assert';
import { describe, it } from 'node:test';

import { parseTargetUrl, targetInfo } from '../create-pr.js';

describe('parseTargetUrl', () => {
  it('Should parse the correct target vector Urls', async () => {
    const target =
      's3://linz-basemaps/vector/3857/53382-nz-roads-addressing/01HSF04SG9M1P3V667A4NZ1MN8/53382-nz-roads-addressing.tar.co';
    const { bucket, epsg, name, filename } = parseTargetUrl(target, 1);
    assert.equal(bucket, 'linz-basemaps');
    assert.equal(epsg.code, 3857);
    assert.equal(name, '53382-nz-roads-addressing');
    assert.equal(filename, '53382-nz-roads-addressing.tar.co');
  });

  it('Should parse the correct target raster Urls', async () => {
    const target = 's3://linz-basemaps/3857/canterbury_rural_2014-2015_0-30m_RGBA/01HSF04SG9M1P3V667A4NZ1MN8/';
    const { bucket, epsg, name, filename } = parseTargetUrl(target, 0);
    assert.equal(bucket, 'linz-basemaps');
    assert.equal(epsg.code, 3857);
    assert.equal(name, 'canterbury_rural_2014-2015_0-30m_RGBA');
    assert.equal(filename, undefined);
  });

  it('Should parse the correct target elevation Urls', async () => {
    const target = 's3://linz-basemaps/elevation/3857/bay-of-plenty_2019-2022_dem_1m/01HSF04SG9M1P3V667A4NZ1MN8/';
    const { bucket, epsg, name, filename } = parseTargetUrl(target, 1);
    assert.equal(bucket, 'linz-basemaps');
    assert.equal(epsg.code, 3857);
    assert.equal(name, 'bay-of-plenty_2019-2022_dem_1m');
    assert.equal(filename, undefined);
  });

  it('Should thrown with incorrect offsets', async () => {
    const validRaster = 's3://linz-basemaps/3857/bay-of-plenty_2019-2022_dem_1m/01HSF04SG9M1P3V667A4NZ1MN8/';
    const test1 = (): targetInfo => parseTargetUrl(validRaster, 1);
    assert.throws(test1, /Invalid target/);

    const validVector =
      's3://linz-basemaps/vector/3857/53382-nz-roads-addressing/01HSF04SG9M1P3V667A4NZ1MN8/53382-nz-roads-addressing.tar.co';
    const test2 = (): targetInfo => parseTargetUrl(validVector, 0);
    assert.throws(test2, /Invalid target/);

    const validElevation =
      's3://linz-basemaps/elevation/3857/bay-of-plenty_2019-2022_dem_1m/01HSF04SG9M1P3V667A4NZ1MN8/';
    const test3 = (): targetInfo => parseTargetUrl(validElevation, 0);
    assert.throws(test3, /Invalid target/);
  });

  it('Should thrown with incorrect target urls', async () => {
    const invalidEpsg = 's3://linz-basemaps/999/bay-of-plenty_2019-2022_dem_1m/01HSF04SG9M1P3V667A4NZ1MN8/';
    const test1 = (): targetInfo => parseTargetUrl(invalidEpsg, 0);
    assert.throws(test1, /Invalid target/);
  });
});
