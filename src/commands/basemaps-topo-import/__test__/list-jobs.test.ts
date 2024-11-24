import assert from 'node:assert';
import { describe, it } from 'node:test';

import { extractMapSheetName } from '../list-jobs.js';

describe('extractMapSheetName', () => {
  const FakeDomain = 's3://topographic/fake-domain';
  const FakeFiles = [
    { actual: `${FakeDomain}/MB07_GeoTifv1-00.tif`, expected: 'MB07_v1-00' },
    { actual: `${FakeDomain}/MB07_GRIDLESS_GeoTifv1-00.tif`, expected: 'MB07_v1-00' },
    { actual: `${FakeDomain}/MB07_TIFFv1-00.tif`, expected: 'MB07_v1-00' },
    { actual: `${FakeDomain}/MB07_TIFF_600v1-00.tif`, expected: 'MB07_v1-00' },
    { actual: `${FakeDomain}/AX32ptsAX31AY31AY32_GeoTifv1-00.tif`, expected: 'AX32ptsAX31AY31AY32_v1-00' },
    { actual: `${FakeDomain}/AZ36ptsAZ35BA35BA36_GeoTifv1-00.tif`, expected: 'AZ36ptsAZ35BA35BA36_v1-00' },
  ];

  it('Should parse the correct MapSheet Names', async () => {
    for (const file of FakeFiles) {
      const output = extractMapSheetName(file.actual);
      assert.equal(output, file.expected);
    }
  });

  it('Should not able to parse a version from file', async () => {
    const wrongFiles = [`${FakeDomain}/MB07_GeoTif1-00.tif`, `${FakeDomain}/MB07_TIFF_600v1.tif`];
    for (const file of wrongFiles) {
      assert.throws(() => extractMapSheetName(file), new Error('Version not found in the file name'));
    }
  });
});
