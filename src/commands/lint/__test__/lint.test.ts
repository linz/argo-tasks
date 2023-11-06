import assert from 'node:assert';
import { describe, it } from 'node:test';

import { AdditionalKeyError, InvalidKeyError, MissingKeyError, lintImageryPath, lintPath } from '../lint.s3.paths.js';

describe('lintImageryPaths', () => {
  it('Should Fail - Incorrect Bucket Name', () => {
    assert.throws(() => {
      lintPath('s3://n-imagery/auckland/auckland_2012_0.075m/rgb/2193/');
    }, InvalidKeyError);
  });
  it('Should Fail - Missing key (Product)', () => {
    assert.throws(() => {
      lintPath('s3://nz-imagery/auckland/auckland_2012_0.075m/2193/');
    }, MissingKeyError);
  });
  it('Should Fail - Extra args', () => {
    assert.throws(() => {
      lintPath('s3://nz-imagery/auckland/auckland_2012_0.075m/rgb/2193/extra-args/');
    }, AdditionalKeyError);
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
      lintImageryPath('hawkesbay', 'rgb', '2193');
    }, InvalidKeyError);
  });
  it('Should Fail - Incorrect product', () => {
    assert.throws(() => {
      lintImageryPath('hawkes-bay', 'rgbi', '2193');
    }, InvalidKeyError);
  });
  it('Should Fail - Incorrect Crs', () => {
    assert.throws(() => {
      lintImageryPath('auckland', 'rgb', '219');
    }, InvalidKeyError);
  });
  it('Should Pass', () => {
    assert.ok(() => {
      lintImageryPath('auckland', 'rgb', '2193');
    });
  });
});
