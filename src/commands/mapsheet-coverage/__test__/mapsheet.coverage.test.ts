import assert from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { Nztm2000QuadTms, Projection } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import { featuresToMultiPolygon } from '@linzjs/geojson';
import type { StacCollection } from 'stac-ts';

import { MapSheet } from '../../../utils/mapsheet.ts';
import { commandMapSheetCoverage, isLargeRegion } from '../mapsheet.coverage.ts';

// convert a collection of map sheets into a multipolygon
function mapSheetToGeoJson(...sheetCodes: string[]): GeoJSON.Feature {
  const features = sheetCodes.map((sc) => {
    const ms = MapSheet.getMapTileIndex(sc);
    if (ms == null) throw new Error('Invalid mapsheet');
    return Projection.get(Nztm2000QuadTms).boundsToGeoJsonFeature(ms, { sheetCode: sc });
  });
  return { geometry: featuresToMultiPolygon(features), type: 'Feature', properties: {} };
}

/** Convert a collection's links to their approx map sheet area */
function collectionToCaptureArea(c: StacCollection): GeoJSON.Feature {
  return mapSheetToGeoJson(
    ...c.links.filter((f) => f.rel === 'item').map((m) => m.href.replace('./', '').replace('.json', '')),
  );
}

function fakeCollection(id: string): StacCollection {
  return {
    stac_version: '1.0.0',
    type: 'Collection',
    license: 'CC-BY-4.0',
    id: `layer-${id}-id`,
    title: `Layer ${id.toUpperCase()} Title`,
    description: `Layer ${id.toUpperCase()} Description`,
    assets: { capture_area: { href: './capture-area.json' } },
    links: [],
    providers: [
      {
        name: 'First provider',
        roles: ['producer', 'licensor', 'processor'],
      },
      {
        name: 'Second provider',
        roles: ['producer'],
      },
    ],
  } as unknown as StacCollection;
}

describe('mapsheet-coverage', () => {
  const mem = new FsMemory();
  const baseArgs = {
    epsgCode: 2193,
    location: new URL('ms://config.json'),
    output: new URL('ms://output/'),
    compare: undefined,
    verbose: false,
    mapSheet: undefined,
    config: undefined,
  } as const;

  before(() => {
    fsa.register('ms://', mem);
  });

  afterEach(() => {
    mem.files.clear();
  });

  it('should run with a empty config', async () => {
    await fsa.write('ms://config.json', JSON.stringify({ layers: [] }));
    await commandMapSheetCoverage.handler(baseArgs);

    const files = await fsa.toArray(fsa.list('ms://output/'));
    files.sort();
    assert.deepEqual(files, [
      'ms://output/capture-dates.geojson',
      'ms://output/file-list.json',
      'ms://output/layers-combined.geojson.gz',
      'ms://output/layers-source.geojson.gz',
    ]);

    const fileList = await fsa.readJson('ms://output/file-list.json');
    assert.deepEqual(fileList, []);
  });

  it('should error if collection is missing', async () => {
    await fsa.write('ms://config.json', JSON.stringify({ layers: [{ 2193: 'ms://layers/a/', name: 'layer-a' }] }));
    const out = await commandMapSheetCoverage.handler(baseArgs).catch((e) => e as Error);
    assert.equal(String(out), 'CompositeError: Not found');
  });

  it('should error if collection has no capture-area', async () => {
    await fsa.write('ms://config.json', JSON.stringify({ layers: [{ 2193: 'ms://layers/a/', name: 'layer-a' }] }));
    await fsa.write('ms://layers/a/collection.json', JSON.stringify({}));
    const out = await commandMapSheetCoverage.handler(baseArgs).catch((e) => e as Error);
    assert.equal(String(out), 'Error: Missing capture area asset in collection "ms://layers/a/collection.json"');
  });

  it('should cover has no capture-area', async () => {
    const colA = fakeCollection('a');
    colA.links.push({ rel: 'item', href: './BP27.json' });

    await fsa.write('ms://config.json', JSON.stringify({ layers: [{ 2193: 'ms://layers/a/', name: 'layer-a' }] }));
    await fsa.write('ms://layers/a/collection.json', JSON.stringify(colA));
    await fsa.write('ms://layers/a/capture-area.json', JSON.stringify(mapSheetToGeoJson('BP27')));

    const out = await commandMapSheetCoverage.handler(baseArgs).catch((e) => e as Error);
    assert.equal(out, undefined);

    const fileList = await fsa.readJson('ms://output/file-list.json');
    assert.deepEqual(fileList, [{ output: 'BP27', input: ['ms://layers/a/BP27.tiff'], includeDerived: true }]);

    const captureDates = await fsa.readJson<GeoJSON.FeatureCollection>('ms://output/capture-dates.geojson');

    assert.deepEqual(captureDates.features[0]?.properties, {
      title: 'Layer A Title',
      description: 'Layer A Description',
      id: 'layer-a-id',
      license: 'CC-BY-4.0',
      source: 'ms://layers/a/collection.json',
      licensor: 'First provider',
      processor: 'First provider',
      producer: 'First provider, Second provider',
    });
    assert.equal(captureDates.features.length, 1);
  });

  it('should include files with overlap', async () => {
    const colA = fakeCollection('a');
    colA.links.push({ rel: 'item', href: './BP27.json' });
    colA.links.push({ rel: 'item', href: './BP28.json' });

    const colB = fakeCollection('b');
    colB.links.push({ rel: 'item', href: './BP27.json' });

    await fsa.write(
      'ms://config.json',
      JSON.stringify({
        layers: [
          { 2193: 'ms://layers/a/', name: 'layer-a' },
          { 2193: 'ms://layers/b/', name: 'layer-b' },
        ],
      }),
    );
    await fsa.write('ms://layers/a/collection.json', JSON.stringify(colA));
    await fsa.write('ms://layers/a/capture-area.json', JSON.stringify(collectionToCaptureArea(colA)));
    await fsa.write('ms://layers/b/collection.json', JSON.stringify(colB));
    await fsa.write('ms://layers/b/capture-area.json', JSON.stringify(collectionToCaptureArea(colB)));

    const out = await commandMapSheetCoverage.handler(baseArgs).catch((e) => e as Error);
    assert.equal(out, undefined);

    const fileList = await fsa.readJson('ms://output/file-list.json');
    assert.deepEqual(fileList, [
      { output: 'BP27', input: ['ms://layers/a/BP27.tiff', 'ms://layers/b/BP27.tiff'], includeDerived: true },
      { output: 'BP28', input: ['ms://layers/a/BP28.tiff'], includeDerived: true },
    ]);

    const captureDates = await fsa.readJson<GeoJSON.FeatureCollection>('ms://output/capture-dates.geojson');

    assert.deepEqual(captureDates.features[0]?.properties?.['source'], 'ms://layers/b/collection.json');
    assert.deepEqual(captureDates.features[1]?.properties?.['source'], 'ms://layers/a/collection.json');
    assert.equal(captureDates.features.length, 2);
  });

  it('should exclude fully overlapping files', async () => {
    const colA = fakeCollection('a');
    colA.links.push({ rel: 'item', href: './BP27.json' });

    const colB = fakeCollection('b');
    colB.links.push({ rel: 'item', href: './BP27.json' });

    await fsa.write(
      'ms://config.json',
      JSON.stringify({
        layers: [
          { 2193: 'ms://layers/a/', name: 'layer-a' },
          { 2193: 'ms://layers/b/', name: 'layer-b' },
        ],
      }),
    );
    await fsa.write('ms://layers/a/collection.json', JSON.stringify(colA));
    await fsa.write('ms://layers/a/capture-area.json', JSON.stringify(collectionToCaptureArea(colA)));
    await fsa.write('ms://layers/b/collection.json', JSON.stringify(colB));
    await fsa.write('ms://layers/b/capture-area.json', JSON.stringify(collectionToCaptureArea(colB)));

    const out = await commandMapSheetCoverage.handler(baseArgs).catch((e) => e as Error);
    assert.equal(out, undefined);

    const fileList = await fsa.readJson('ms://output/file-list.json');
    assert.deepEqual(fileList, [{ output: 'BP27', input: ['ms://layers/b/BP27.tiff'], includeDerived: true }]);

    const captureDates = await fsa.readJson<GeoJSON.FeatureCollection>('ms://output/capture-dates.geojson');

    assert.deepEqual(captureDates.features[0]?.properties?.['source'], 'ms://layers/b/collection.json');
    assert.equal(captureDates.features.length, 1);
  });
});

describe('isLargeRegion', () => {
  const OneMetreInDegrees = 1e-5;

  it('should not remove large polygons', () => {
    // this polygon is 1 degree x 1 degree at approx 110KM x 110KM
    assert.equal(
      isLargeRegion([
        [
          [0, 0],
          [0, -1],
          [-1, -1],
          [-1, 0],
          [0, 0],
        ],
      ]),
      true,
    );
  });

  it('should remove polygons with long slivers', () => {
    // this polygon is 1 degree x 1cm very small slivers
    // which will be destroyed by the buffering inwards
    assert.equal(
      isLargeRegion([
        [
          [0, 0],
          [1, 0],
          [1, OneMetreInDegrees * 0.01],
          [0, OneMetreInDegrees * 0.01],
          [0, 0],
        ],
      ]),
      false,
    );
  });

  it('should remove small squares', () => {
    // this polygon is 1m x 1m, with a area of 1E-10, it should be removed
    assert.equal(
      isLargeRegion([
        [
          [0, 0],
          [OneMetreInDegrees, 0],
          [OneMetreInDegrees, OneMetreInDegrees],
          [0, OneMetreInDegrees],
          [0, 0],
        ],
      ]),
      false,
    );
  });

  it('should keep medium sized polygons', () => {
    // this polygon is 100m x 100m
    assert.equal(
      isLargeRegion([
        [
          [0, 0],
          [100 * OneMetreInDegrees, 0],
          [100 * OneMetreInDegrees, 100 * OneMetreInDegrees],
          [0, 100 * OneMetreInDegrees],
          [0, 0],
        ],
      ]),
      true,
    );
  });
});
