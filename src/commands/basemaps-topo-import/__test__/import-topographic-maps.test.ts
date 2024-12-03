import assert from 'node:assert';
import { describe, it } from 'node:test';

import { extractMapCodeAndVersion } from '../extractors/extract-map-code-and-version.js';

describe('extractMapCodeAndVersion', () => {
  const FakeDomain = 's3://topographic/fake-domain';
  const FakeFiles = [
    { input: `${FakeDomain}/MB07_GeoTifv1-00.tif`, expected: { mapCode: 'MB07', version: 'v1-00' } },
    { input: `${FakeDomain}/MB07_GRIDLESS_GeoTifv1-00.tif`, expected: { mapCode: 'MB07', version: 'v1-00' } },
    { input: `${FakeDomain}/MB07_TIFFv1-00.tif`, expected: { mapCode: 'MB07', version: 'v1-00' } },
    { input: `${FakeDomain}/MB07_TIFF_600v1-00.tif`, expected: { mapCode: 'MB07', version: 'v1-00' } },
    {
      input: `${FakeDomain}/AX32ptsAX31AY31AY32_GeoTifv1-00.tif`,
      expected: { mapCode: 'AX32ptsAX31AY31AY32', version: 'v1-00' },
    },
    {
      input: `${FakeDomain}/AZ36ptsAZ35BA35BA36_GeoTifv1-00.tif`,
      expected: { mapCode: 'AZ36ptsAZ35BA35BA36', version: 'v1-00' },
    },
  ];

  it('Should parse the correct MapSheet Names', async () => {
    for (const file of FakeFiles) {
      const output = extractMapCodeAndVersion(file.input);
      assert.equal(output.mapCode, file.expected.mapCode, 'Map code does not match');
      assert.equal(output.version, file.expected.version, 'Version does not match');
    }
  });

  it('Should not able to parse a version from file', async () => {
    const wrongFiles = [`${FakeDomain}/MB07_GeoTif1-00.tif`, `${FakeDomain}/MB07_TIFF_600v1.tif`];
    for (const file of wrongFiles) {
      assert.throws(() => extractMapCodeAndVersion(file), new Error('Version not found in the file name'));
    }
  });
});
