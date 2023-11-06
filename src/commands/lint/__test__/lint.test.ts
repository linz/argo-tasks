import assert from 'node:assert';
import { describe, it } from 'node:test';

import { lintImageryPath, lintPath } from '../lint.s3.paths.js';

describe('lintImageryPaths', () => {
  it('Should Fail - Incorrect Bucket Name', () => {
    assert.throws(() => {
      lintPath('s3://n-imagery/auckland/auckland_2012_0.075m/rgb/2193/');
    }, Error('bucket not in bucket list: n-imagery'));
  });
  it('Should Fail - Missing key (Product)', () => {
    assert.throws(() => {
      lintPath('s3://nz-imagery/auckland/auckland_2012_0.075m/2193/');
    }, Error('Missing key in Path: /auckland/auckland_2012_0.075m/2193/'));
  });
  it('Should Fail - Extra args', () => {
    assert.throws(() => {
      lintPath('s3://nz-imagery/auckland/auckland_2012_0.075m/rgb/2193/extra-args/');
    }, Error('Too many keys in Path: /auckland/auckland_2012_0.075m/rgb/2193/extra-args/'));
  });
  it('Should Pass', () => {
    assert.ok(() => {
      lintPath('s3://nz-imagery/auckland/auckland_2012_0.075m/rgb/2193/');
    });
  });
});

describe('lintImageryPaths', () => {
  it('Should Fail - Incorrect Region', () => {
    assert.throws(() => {
      lintImageryPath('/hawkesbay/hawkes-bay_2018_0-75m/rgb/2193/');
    }, Error('region not in region list: hawkesbay'));
  });
  it('Should Fail - Incorrect product', () => {
    assert.throws(() => {
      lintImageryPath('/hawkes-bay/hawkes-bay_2018_0-75m/rgbi/2193/');
    }, Error('product not in product list: rgbi'));
  });
  it('Should Fail - Incorrect Crs', () => {
    assert.throws(() => {
      lintImageryPath('/auckland/auckland_2020_0-2m/rgb/219/');
    }, Error('crs not in crs list: 219'));
  });
  it('Should Pass', () => {
    assert.ok(() => {
      lintImageryPath('/auckland/auckland_2020_0-2m/rgb/2193/');
    });
  });
});
