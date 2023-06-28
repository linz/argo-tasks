import o from 'ospec';
import {
  TiffLoader,
  commandTileIndexValidate,
  extractTiffLocations,
  getTileName,
  groupByTileName,
} from '../tileindex.validate.js';
import { FakeCogTiff } from './tileindex.validate.data.js';
import { MapSheet } from '../../../utils/mapsheet.js';
import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import { createSandbox } from 'sinon';
import assert from 'assert';
// import { logger } from '../../../log.js';

function convertTileName(x: string, scale: number): string | null {
  const extract = MapSheet.extract(x);
  if (extract == null) return null;
  return getTileName(extract.bbox[0], extract.bbox[3], scale);
}

o.spec('getTileName', () => {
  o('should get correct parent tile 1:1k', () => {
    o(convertTileName('CH11_1000_0101', 1000)).equals('CH11_1000_0101');
    o(convertTileName('CH11_1000_0105', 1000)).equals('CH11_1000_0105');
    o(convertTileName('CH11_1000_0501', 1000)).equals('CH11_1000_0501');
    o(convertTileName('CH11_1000_0505', 1000)).equals('CH11_1000_0505');
  });
  o('should get correct parent tile 1:5k', () => {
    o(convertTileName('CH11_1000_0101', 5000)).equals('CH11_5000_0101');
    o(convertTileName('CH11_1000_0105', 5000)).equals('CH11_5000_0101');
    o(convertTileName('CH11_1000_0501', 5000)).equals('CH11_5000_0101');
    o(convertTileName('CH11_1000_0505', 5000)).equals('CH11_5000_0101');
  });

  o('should get correct parent tile 1:10k', () => {
    o(convertTileName('CH11_1000_0101', 10000)).equals('CH11_10000_0101');
    o(convertTileName('CH11_1000_0110', 10000)).equals('CH11_10000_0101');
    o(convertTileName('CH11_1000_1010', 10000)).equals('CH11_10000_0101');
    o(convertTileName('CH11_1000_1001', 10000)).equals('CH11_10000_0101');
  });
});
o.spec('tiffLocation', () => {
  // logger.level = 'silent'
  o('get location from tiff', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    const location = await extractTiffLocations([TiffAs21, TiffAy29], 1000);
    o(location[0]?.tileName).equals('AS21_1000_0101');
    o(location[1]?.tileName).equals('AY29_1000_0101');
  });

  o('should find duplicates', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    const location = await extractTiffLocations([TiffAs21, TiffAy29, TiffAs21, TiffAy29], 1000);
    const duplicates = groupByTileName(location);
    o(duplicates.get('AS21_1000_0101')?.map((c) => c.source)).deepEquals([
      's3://path/AS21_1000_0101.tiff',
      's3://path/AS21_1000_0101.tiff',
    ]);
    o(duplicates.get('AY29_1000_0101')?.map((c) => c.source)).deepEquals([
      's3://path/AY29_1000_0101.tiff',
      's3://path/AY29_1000_0101.tiff',
    ]);
  });

  o('should find tiles from 3857', async () => {
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].epsg = 3857;
    TiffAy29.images[0].origin[0] = 19128043.69337794;
    TiffAy29.images[0].origin[1] = -4032710.6009459053;
    const location = await extractTiffLocations([TiffAy29], 1000);
    o(location[0]?.tileName).equals('AS21_1000_0101');
  });
});

o.spec('validate', () => {
  const memory = new FsMemory();
  const sandbox = createSandbox();

  o.before(() => {
    fsa.register('/tmp', memory);
  });
  o.beforeEach(() => memory.files.clear());
  o.afterEach(() => sandbox.restore());

  o('should fail if duplicate tiles are detected', async () => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    const stub = sandbox
      .stub(TiffLoader, 'load')
      .returns(
        Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
      );
    try {
      await commandTileIndexValidate.handler({
        location: ['s3://test'],
        retile: false,
        validate: true,
        scale: 1000,
        forceOutput: true,
      } as any);
    } catch (e) {
      o(String(e)).equals('Error: Duplicate files found, see output.geojson');
    }

    o(stub.callCount).equals(1);
    o(stub.args?.[0]?.[0]).deepEquals(['s3://test']);

    const outputFileList: GeoJSON.FeatureCollection = await fsa.readJson('/tmp/tile-index-validate/output.geojson');
    o(outputFileList.features.length).equals(1);
    const firstFeature = outputFileList.features[0];
    o(firstFeature?.properties?.['tileName']).equals('AS21_1000_0101');
    o(firstFeature?.properties?.['source']).deepEquals([
      's3://path/AS21_1000_0101.tiff',
      's3://path/AS21_1000_0101.tiff',
    ]);
  });

  o('should not fail if duplicate tiles are detected but --retile is used', async () => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    sandbox
      .stub(TiffLoader, 'load')
      .returns(
        Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')]),
      );
    await commandTileIndexValidate.handler({
      location: ['s3://test'],
      retile: true,
      scale: 1000,
      forceOutput: true,
    } as any);
    const outputFileList = await fsa.readJson('/tmp/tile-index-validate/file-list.json');
    o(outputFileList).deepEquals([
      { output: 'AS21_1000_0101', input: ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'] },
    ]);
  });

  for (const offset of [0.05, -0.05]) {
    o(`should fail if input tiff origin X is offset by ${offset}m`, async () => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].origin[0] = fakeTiff.images[0].origin[0] + offset;
      sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
        assert.fail('Should throw exception');
      } catch (e) {
        o(String(e)).equals('Error: Tile alignment validation failed');
      }
    });
    o(`should fail if input tiff origin Y is offset by ${offset}m`, async () => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].origin[1] = fakeTiff.images[0].origin[1] + offset;
      sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
        assert.fail('Should throw exception');
      } catch (e) {
        o(String(e)).equals('Error: Tile alignment validation failed');
      }
    });
  }
  for (const offset of [0.1, -0.1]) {
    // Input AS21_1000_0101.tiff width/height by +1m, -1m =>
    // 720x480 => 721x480
    // 720x481 => 720x481
    // 721x481 => 721x481
    o(`should fail if input tiff width is off by ${offset}m`, async () => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].size.width = fakeTiff.images[0].size.width + offset;
      sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
        assert.fail('Should throw exception');
      } catch (e) {
        o(String(e)).equals('Error: Tile alignment validation failed');
      }
    });
    o(`should fail if input tiff height is off by ${offset}m`, async () => {
      const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
      fakeTiff.images[0].size.height = fakeTiff.images[0].size.height + offset;
      sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([fakeTiff]));
      try {
        await commandTileIndexValidate.handler({
          location: ['s3://test'],
          retile: true,
          validate: true,
          scale: 1000,
          forceOutput: true,
        } as any);
        assert.fail('Should throw exception');
      } catch (e) {
        o(String(e)).equals('Error: Tile alignment validation failed');
      }
    });
  }
});

// o.run();
