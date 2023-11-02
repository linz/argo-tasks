import assert from 'node:assert';
import { describe, it } from 'node:test';

import { lintODRImageryPath } from '../lint.s3.paths.js';

describe('lintODRImageryPaths', () => {
  it('Should Fail - Missing key', () => {
    assert.throws(() => {
      lintODRImageryPath('s3://nz-imagery/auckland/auckland_2012_0.075m/2193/');
    }, Error);
  });
  it('Should Fail - Incorrect Bucket Name', () => {
    assert.throws(() => {
      lintODRImageryPath('s3://n-imagery/auckland/auckland_2012_0.075m/rgb/2193/');
    }, Error);
  });
  it('Should Fail - Incorrect Region', () => {
    assert.throws(() => {
      lintODRImageryPath('s3://nz-imagery/hawkesbay/hawkes-bay_2012_0.075m/rgb/2193/');
    }, Error);
  });
  it('Should Fail - Incorrect product', () => {
    assert.throws(() => {
      lintODRImageryPath('s3://nz-imagery/hawkes-bay/hawkes-bay_2012_0.075m/rgbi/2193/');
    }, Error);
  });
  it('Should Fail - Incorrect Crs', () => {
    assert.throws(() => {
      lintODRImageryPath('s3://nz-imagery/auckland/auckland_2012_0.075m/rgb/219/');
    }, Error);
  });
  it('Should Pass', () => {
    assert.ok(() => {
      lintODRImageryPath('s3://nz-imagery/auckland/auckland_2012_0.075m/rgb/2193/');
    });
  });
});
