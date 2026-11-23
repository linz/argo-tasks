import { Projection } from '@basemaps/geo';
import { fsa, FsMemory } from '@chunkd/fs';
import type { Source } from '@cogeotiff/core';
import { SampleFormat, Tiff, TiffTag } from '@cogeotiff/core';
import type { BBox } from '@linzjs/geojson';
import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';
import { pathToFileURL } from 'url';

import { logger } from '../../../log.ts';
import { fakeLasHeader } from '../../../utils/__test__/las.data.ts';
import { MapSheetData } from '../../../utils/__test__/mapsheet.data.ts';
import { ConcurrentQueue } from '../../../utils/concurrent.queue.ts';
import type { FileListEntryClass } from '../../../utils/filelist.ts';
import { isTiff } from '../../../utils/geotiff.ts';
import type { GridSize } from '../../../utils/mapsheet.ts';
import { ChathamMapSheet, MapSheet } from '../../../utils/mapsheet.ts';
import { createTiff, Url } from '../../common.ts';
import {
  commandTileIndexValidate,
  determineGridSizeFromGSDPreset,
  extractLocations,
  FileLoader,
  getSize,
  getTileName,
  GridSizeFromString,
  groupByTileName,
  PointCloudSource,
  reprojectIfNeeded,
  TiffFiles,
  TiffSource,
  validatePreset,
  validateTiffDataType,
} from '../tileindex.validate.ts';
import { FakeCogTiff } from './tileindex.validate.data.ts';

const toSource = (tiff: Tiff): TiffSource => new TiffSource(tiff);

function convertTileName(fileName: string, gridSize: GridSize): string | null {
  const mapTileIndex = MapSheet.getMapTileIndex(fileName);
  if (mapTileIndex == null) return null;
  return getTileName(mapTileIndex.bbox[0], mapTileIndex.bbox[3], gridSize);
}

describe('getTileName', () => {
  it('should get correct parent tile 1:1k', () => {
    assert.equal(convertTileName('CH11_1000_0101', 1000), 'CH11_1000_0101');
    assert.equal(convertTileName('CH11_1000_0105', 1000), 'CH11_1000_0105');
    assert.equal(convertTileName('CH11_1000_0501', 1000), 'CH11_1000_0501');
    assert.equal(convertTileName('CH11_1000_0505', 1000), 'CH11_1000_0505');
  });
  it('should get correct parent tile 1:5k', () => {
    assert.equal(convertTileName('CH11_1000_0101', 5000), 'CH11_5000_0101');
    assert.equal(convertTileName('CH11_1000_0105', 5000), 'CH11_5000_0101');
    assert.equal(convertTileName('CH11_1000_0501', 5000), 'CH11_5000_0101');
    assert.equal(convertTileName('CH11_1000_0505', 5000), 'CH11_5000_0101');
  });

  it('should get correct parent tile 1:10k', () => {
    assert.equal(convertTileName('CH11_1000_0101', 10000), 'CH11_10000_0101');
    assert.equal(convertTileName('CH11_1000_0110', 10000), 'CH11_10000_0101');
    assert.equal(convertTileName('CH11_1000_1010', 10000), 'CH11_10000_0101');
    assert.equal(convertTileName('CH11_1000_1001', 10000), 'CH11_10000_0101');
  });
  it('should get correct parent tile 1:50k', () => {
    assert.equal(convertTileName('AT24_50000_0101', 50000), 'AT24');
    assert.equal(convertTileName('AT25_50000_0101', 50000), 'AT25');
    assert.equal(convertTileName('CK08_50000_0101', 50000), 'CK08');
  });

  it('should get the top left 1:50k, 1:10k, 1:5k, 1:1k, and 1:500 for all sheets', () => {
    for (const sheet of MapSheetData) {
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 50000), sheet.code);
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 10000), sheet.code + '_10000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 5000), sheet.code + '_5000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 1000), sheet.code + '_1000_0101');
      assert.equal(getTileName(sheet.origin.x, sheet.origin.y, 500), sheet.code + '_500_001001');
    }
  });

  it('should get the bottom right 1:50k, 1:10k, 1:5k, 1:1k for all sheets', () => {
    for (const sheet of MapSheetData) {
      // for each scale calculate the bottom right tile then find the mid point of it
      // then look up the tile name from the midpoint and ensure it is the same
      for (const scale of [10_000, 5_000, 1_000, 500] as const) {
        const tileCount = 50_000 / scale;
        const tileName = `${tileCount - 1}`.padStart(scale === 500 ? 3 : 2, '0');
        const sheetName = `${sheet.code}_${scale}_${tileName}${tileName}`;
        const ret = MapSheet.getMapTileIndex(sheetName)!;
        const midPointX = ret.origin.x + ret.width / 2;
        const midPointY = ret.origin.y - ret.height / 2;
        assert.equal(getTileName(midPointX, midPointY, scale), sheetName);
      }
    }
  });
});
describe('tiffLocation', () => {
  it('get location from tiff', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    const location = await extractLocations([TiffAs21, TiffAy29].map(toSource), 1000);
    assert.deepEqual(location[0]?.tileNames, ['AS21_1000_0101']);
    assert.deepEqual(location[1]?.tileNames, ['AY29_1000_0101']);
  });

  it('should find duplicates', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    const location = await extractLocations([TiffAs21, TiffAy29, TiffAs21, TiffAy29].map(toSource), 1000);
    const duplicates = groupByTileName(location);
    assert.deepEqual(
      duplicates.get('AS21_1000_0101')?.map((c) => c.source.href),
      ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'],
    );
    assert.deepEqual(
      duplicates.get('AY29_1000_0101')?.map((c) => c.source.href),
      ['s3://path/AY29_1000_0101.tiff', 's3://path/AY29_1000_0101.tiff'],
    );
  });

  it('should find tiles from 3857 when explicitly reprojecting to 2193', async () => {
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].epsg = 3857;
    TiffAy29.images[0].origin[0] = 19128043.69337794;
    TiffAy29.images[0].origin[1] = -4032710.6009459053;
    const location = await extractLocations([TiffAy29].map(toSource), 1000, undefined, 2193);
    assert.deepEqual(location[0]?.tileNames, ['AS21_1000_0101']);
  });

  it('should fail for a source EPSG with no known map sheet grid when no target-epsg is given', async () => {
    // 3857 has no map sheet grid of its own, and with no explicit target-epsg there is nothing to
    // reproject into - this must fail loudly rather than silently mis-tiling (as previously happened
    // for Chatham Islands imagery, see the "Chatham Islands" test below).
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].epsg = 3857;
    TiffAy29.images[0].origin[0] = 19128043.69337794;
    TiffAy29.images[0].origin[1] = -4032710.6009459053;
    await assert.rejects(extractLocations([TiffAy29].map(toSource), 1000));
  });

  it('should fail if one location is not extracted', async () => {
    const TiffAs21 = FakeCogTiff.fromTileName('AS21_1000_0101');
    TiffAs21.images[0].origin[0] = 1492000;
    TiffAs21.images[0].origin[1] = 6234000;
    const TiffAy29 = FakeCogTiff.fromTileName('AY29_1000_0101');
    TiffAy29.images[0].origin[0] = 1684000;
    TiffAy29.images[0].origin[1] = 6018000;
    TiffAy29.images[0].epsg = 0; // make the projection failing
    await assert.rejects(extractLocations([TiffAs21, TiffAy29].map(toSource), 1000));
  });

  it('should tile Chatham Islands (EPSG:3793) imagery against the Chatham grid when explicitly requested', async () => {
    const chathamTileIndex = ChathamMapSheet.getMapTileIndex('CI06_5000_0507');
    if (chathamTileIndex == null) throw new Error('Failed to compute test fixture tile index');

    const TiffCI06 = new FakeCogTiff('s3://path/CI06_5000_0507.tiff', {
      origin: [chathamTileIndex.origin.x, chathamTileIndex.origin.y],
      size: { width: chathamTileIndex.width, height: chathamTileIndex.height },
      epsg: 3793,
    });

    const location = await extractLocations([TiffCI06].map(toSource), 5000, undefined, 3793);
    assert.deepEqual(location[0]?.tileNames, ['CI06_5000_0507']);
  });

  it('should tile Chatham Islands (EPSG:3793) imagery against the Chatham grid by default, with no target-epsg given', async () => {
    const chathamTileIndex = ChathamMapSheet.getMapTileIndex('CI06_5000_0507');
    if (chathamTileIndex == null) throw new Error('Failed to compute test fixture tile index');

    const TiffCI06 = new FakeCogTiff('s3://path/CI06_5000_0507.tiff', {
      origin: [chathamTileIndex.origin.x, chathamTileIndex.origin.y],
      size: { width: chathamTileIndex.width, height: chathamTileIndex.height },
      epsg: 3793,
    });

    const location = await extractLocations([TiffCI06].map(toSource), 5000);
    assert.deepEqual(location[0]?.tileNames, ['CI06_5000_0507']);
  });
});

describe('validate', () => {
  const memory = new FsMemory();

  before(() => {
    fsa.register('file:///tmp', memory);
    fsa.register('memory://', memory);
  });
  beforeEach(() => memory.files.clear());

  const baseArguments = {
    config: undefined,
    verbose: false,
    sourceType: 'raster' as const,
    include: undefined,
    preset: 'none',
    sourceEpsg: undefined,
    sourceVerticalEpsg: undefined,
    targetEpsg: 2193,
    includeDerived: false,
    scale: 1000 as GridSize,
    forceOutput: true,
    location: [[fsa.toUrl('memory://test/')]],
    concurrency: 1,
  };

  it('should set the includeDerived flag in file-list.json based on its input flag', async (t) => {
    t.mock.method(FileLoader, 'load', () =>
      Promise.resolve([FakeCogTiff.fromTileName('AS21_1000_0101')].map(toSource)),
    );
    for (const includeDerived of [true, false]) {
      await commandTileIndexValidate.handler({
        ...baseArguments,
        includeDerived: includeDerived,
      });
      const outputFileList: [FileListEntryClass] = await fsa.readJson(
        fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
      );
      assert.strictEqual(outputFileList[0]?.includeDerived, includeDerived);
    }
  });

  it('should read from utf8 sources', async (t) => {
    const fakeTiff = FakeCogTiff.fromTileName('BQ32_1000_0101');
    // Destroy the "geo" part of geotiff so TFW loading is also checked fro URL handling
    Object.defineProperty(fakeTiff.images[0], 'isGeoLocated', { value: false });

    const sourceLocation = await Url.from(`memory://some-bucket/🦄 🌈/`);
    fakeTiff.source.url = new URL(`BQ32_1000_0101.tiff`, sourceLocation);

    const expectedBounds = MapSheet.getMapTileIndex('BQ32_1000_0101');
    assert.ok(expectedBounds);

    await fsa.write(
      new URL('BQ32_1000_0101.tfw', sourceLocation),
      `1\n0\n0\n-1\n${expectedBounds?.origin.x + 0.5}\n${expectedBounds?.origin.y - 0.5}`,
    );

    const stub = t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff].map(toSource)));
    await commandTileIndexValidate.handler({
      ...baseArguments,
      location: [[sourceLocation]],
    });

    const fileList: unknown[] = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));

    assert.deepEqual(fileList[0], {
      output: 'BQ32_1000_0101',
      input: [`memory://some-bucket/🦄 🌈/BQ32_1000_0101.tiff`],
      includeDerived: false,
    });
    assert.equal(stub.mock.callCount(), 1);
  });

  const root = 'memory://bucket/';
  // In S3 listing order, each folder has a unique file sorting before its sub-folders and an x.tiff sorting after them
  const files = ['a/a.tiff', 'a/b/b.tiff', 'a/b/c/c.tiff', 'a/b/c/x.tiff', 'a/b/x.tiff', 'a/x.tiff'];
  const cases = [
    {
      folders: ['a/', 'a/b/', 'a/b/c/'],
      expected: ['a/a.tiff', 'a/x.tiff', 'a/b/b.tiff', 'a/b/x.tiff', 'a/b/c/c.tiff', 'a/b/c/x.tiff'],
    },
    {
      folders: ['a/', 'a/b/c/', 'a/b/'],
      expected: ['a/a.tiff', 'a/x.tiff', 'a/b/c/c.tiff', 'a/b/c/x.tiff', 'a/b/b.tiff', 'a/b/x.tiff'],
    },
    {
      folders: ['a/b/', 'a/', 'a/b/c/'],
      expected: ['a/b/b.tiff', 'a/b/x.tiff', 'a/a.tiff', 'a/x.tiff', 'a/b/c/c.tiff', 'a/b/c/x.tiff'],
    },
    {
      folders: ['a/b/', 'a/b/c/', 'a/'],
      expected: ['a/b/b.tiff', 'a/b/x.tiff', 'a/b/c/c.tiff', 'a/b/c/x.tiff', 'a/a.tiff', 'a/x.tiff'],
    },
    {
      folders: ['a/b/c/', 'a/', 'a/b/'],
      expected: ['a/b/c/c.tiff', 'a/b/c/x.tiff', 'a/a.tiff', 'a/x.tiff', 'a/b/b.tiff', 'a/b/x.tiff'],
    },
    {
      folders: ['a/b/c/', 'a/b/', 'a/'],
      expected: ['a/b/c/c.tiff', 'a/b/c/x.tiff', 'a/b/b.tiff', 'a/b/x.tiff', 'a/a.tiff', 'a/x.tiff'],
    },
    {
      folders: ['a/b/', 'a/', 'a/b/'],
      expected: ['a/a.tiff', 'a/x.tiff', 'a/b/b.tiff', 'a/b/c/c.tiff', 'a/b/c/x.tiff', 'a/b/x.tiff'],
    },
  ];
  for (const { folders, expected } of cases) {
    it(`should load ${folders.join(';')} with each file once, in order of its most specific folder`, async (t) => {
      for (const file of files) await fsa.write(fsa.toUrl(root + file), Buffer.alloc(0));
      // Stub loading so files earlier in the listing finish last
      t.mock.method(Tiff, 'create', async (source: Source) => {
        const index = files.indexOf(source.url.href.replace(root, ''));
        await new Promise((r) => setTimeout(r, (files.length - index) * 5));
        return { source } as Tiff;
      });

      const tiffs = await FileLoader.load(
        TiffFiles,
        folders.map((folder) => fsa.toUrl(root + folder)),
        new ConcurrentQueue(files.length),
      );

      assert.deepEqual(
        tiffs.map((tiff) => tiff.source.href.replace(root, '')),
        expected,
      );
    });
  }

  for (const { folders, expected } of [
    {
      folders: ['delivery/', 'delivery/add/'],
      expected: ['delivery/BG35_1000_4829.tiff', 'delivery/add/BG35_1000_4829.tiff'],
    },
    {
      folders: ['delivery/add/', 'delivery/'],
      expected: ['delivery/add/BG35_1000_4829.tiff', 'delivery/BG35_1000_4829.tiff'],
    },
  ]) {
    it(`should write ${folders.join(';')} inputs to file-list.json once each, in order of their most specific folder`, async () => {
      // Both orders list the same files, so only the location order decides the file-list.json inputs
      const tiffBytes = await fsa.read(pathToFileURL('./src/commands/tileindex-validate/__test__/data/8b.tiff'));
      for (const file of ['delivery/BG35_1000_4829.tiff', 'delivery/add/BG35_1000_4829.tiff']) {
        await fsa.write(fsa.toUrl(root + file), tiffBytes);
      }

      await commandTileIndexValidate.handler({
        ...baseArguments,
        location: [folders.map((folder) => fsa.toUrl(root + folder))],
      });

      const fileList: unknown = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
      assert.deepEqual(fileList, [
        { output: 'BG35_1000_4829', input: expected.map((file) => root + file), includeDerived: false },
      ]);
    });
  }

  it('should fail with 0 byte tiffs', async () => {
    await fsa.write(fsa.toUrl('file:///tmp/empty/foo.tiff'), Buffer.from(''));
    const ret = await commandTileIndexValidate
      .handler({
        ...baseArguments,
        location: [[fsa.toUrl('file:///tmp/empty/')]],
      })
      .catch((e: Error) => e);
    assert.equal(String(ret), 'Error: Tiff loading failed: Error: Unable to read empty tiff');
  });

  const pointCloudArguments = {
    ...baseArguments,
    sourceType: 'pointcloud' as const,
    scale: 5000 as GridSize,
    location: [[fsa.toUrl('memory://pc/')]],
  };

  it('should place point clouds in the tile of their centroid', async () => {
    for (const tile of ['BY16_1000_1649', 'BY16_1000_1650']) {
      const [minX, minY, maxX, maxY] = MapSheet.getMapTileIndex(tile)?.bbox ?? [0, 0, 0, 0];
      await fsa.write(
        fsa.toUrl(`memory://pc/CL2_${tile}.laz`),
        fakeLasHeader([minX - 20, minY - 20, maxX + 20, maxY + 20]),
      );
    }
    await commandTileIndexValidate.handler(pointCloudArguments);
    const fileList: FileListEntryClass[] = await fsa.readJson(
      fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
    );
    assert.deepEqual(
      fileList.map((f) => [f.output, f.input.length]),
      [['BY16_5000_0410', 2]],
    );
    const output = async (name: string): Promise<string> =>
      String(await fsa.read(fsa.toUrl(`file:///tmp/tile-index-validate/${name}`)));
    assert.deepEqual(await Promise.all(['gsd', 'data-type', 'density', 'point-format', 'crs'].map(output)), [
      '',
      '',
      '0.00253',
      '6',
      'EPSG:2193+7839',
    ]);
  });

  it('should fail early listing every point cloud with a bad or different CRS', async () => {
    const bbox = MapSheet.getMapTileIndex('BY16_1000_1649')?.bbox ?? [0, 0, 0, 0];
    const files = {
      'good-1': {},
      'good-2': {},
      broken: { verticalDatum: 7839 },
      flat: { vertical: null },
      other: { vertical: 4440 },
    };
    for (const [name, opts] of Object.entries(files)) {
      await fsa.write(fsa.toUrl(`memory://pc/${name}.laz`), fakeLasHeader(bbox, opts));
    }
    await assert.rejects(commandTileIndexValidate.handler(pointCloudArguments), (e: Error) => {
      assert.equal(
        e.message.split('\n').slice(1).join('\n'),
        [
          'memory://pc/broken.laz: vertical datum is the CRS code 7839',
          'memory://pc/flat.laz: no vertical CRS',
          'memory://pc/other.laz: EPSG:2193+4440, most files are EPSG:2193+7839',
        ].join('\n'),
      );
      assert.match(e.message, /run fix-laz-header/);
      return true;
    });
  });

  it('should force the CRS of point clouds to the source EPSG codes', async () => {
    const bbox = MapSheet.getMapTileIndex('BY16_1000_1649')?.bbox ?? [0, 0, 0, 0];
    const files = {
      good: {},
      broken: { verticalDatum: 7839 },
      flat: { vertical: null },
      none: { epsg: null },
      other: { epsg: 3793, vertical: 4440 },
    };
    for (const [name, opts] of Object.entries(files)) {
      await fsa.write(fsa.toUrl(`memory://pc/${name}.laz`), fakeLasHeader(bbox, opts));
    }
    await commandTileIndexValidate.handler({ ...pointCloudArguments, sourceEpsg: 2193, sourceVerticalEpsg: 4440 });
    const fileList: FileListEntryClass[] = await fsa.readJson(
      fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
    );
    assert.deepEqual(
      fileList.map((f) => [f.output, f.input.length]),
      [['BY16_5000_0410', 5]],
    );
    assert.equal(String(await fsa.read(fsa.toUrl('file:///tmp/tile-index-validate/crs'))), 'EPSG:2193+4440');
  });

  it('should fail on point cloud CRS without a most common one', async () => {
    const bbox = MapSheet.getMapTileIndex('BY16_1000_1649')?.bbox ?? [0, 0, 0, 0];
    await fsa.write(fsa.toUrl('memory://pc/a.laz'), fakeLasHeader(bbox));
    await fsa.write(fsa.toUrl('memory://pc/b.laz'), fakeLasHeader(bbox, { vertical: 4440 }));
    await assert.rejects(
      commandTileIndexValidate.handler(pointCloudArguments),
      /\nmemory:\/\/pc\/a.laz: EPSG:2193\+7839, no value is most common\nmemory:\/\/pc\/b.laz: EPSG:2193\+4440, no value is most common$/,
    );
  });

  it('should fail on mixed scales without a most common one', async () => {
    const bbox = MapSheet.getMapTileIndex('BY16_1000_1649')?.bbox ?? [0, 0, 0, 0];
    await fsa.write(fsa.toUrl('memory://pc/a.laz'), fakeLasHeader(bbox, { scale: 0.001 }));
    await fsa.write(fsa.toUrl('memory://pc/b.laz'), fakeLasHeader(bbox, { scale: 0.01 }));
    await assert.rejects(
      commandTileIndexValidate.handler(pointCloudArguments),
      /Mixed scales, no value is most common:\nmemory:\/\/pc\/a.laz: 0.001,0.001,0.001\nmemory:\/\/pc\/b.laz: 0.01,0.01,0.01$/,
    );
  });

  it('should write same-name point clouds to file-list.json in location order', async () => {
    const bbox = MapSheet.getMapTileIndex('BY16_1000_1649')?.bbox ?? [0, 0, 0, 0];
    for (const file of ['pc/BY16_1000_1649.laz', 'pc/add/BY16_1000_1649.laz']) {
      await fsa.write(fsa.toUrl(`memory://${file}`), fakeLasHeader(bbox));
    }
    await commandTileIndexValidate.handler({
      ...pointCloudArguments,
      location: [[fsa.toUrl('memory://pc/'), fsa.toUrl('memory://pc/add/')]],
    });
    const fileList: FileListEntryClass[] = await fsa.readJson(
      fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
    );
    assert.deepEqual(
      fileList.map((f) => f.input),
      [['memory://pc/BY16_1000_1649.laz', 'memory://pc/add/BY16_1000_1649.laz']],
    );
  });

  it('should fail on point clouds without --scale', async () => {
    await assert.rejects(
      commandTileIndexValidate.handler({ ...pointCloudArguments, scale: 'auto' }),
      /Point clouds need a --scale/,
    );
  });

  it('should fail on mixed point formats', async () => {
    const bbox = MapSheet.getMapTileIndex('BY16_1000_1649')?.bbox ?? [0, 0, 0, 0];
    for (const [name, pointFormat] of [
      ['a', 0x86],
      ['b', 0x86],
      ['c', 0x87],
    ] as const) {
      await fsa.write(fsa.toUrl(`memory://pc/${name}.laz`), fakeLasHeader(bbox, { pointFormat }));
    }
    await assert.rejects(
      commandTileIndexValidate.handler(pointCloudArguments),
      /Mixed point formats, most files are 6:\nmemory:\/\/pc\/c.laz: 7$/,
    );
  });

  it('should tile point clouds in the CRS of their header', async () => {
    const bbox = ChathamMapSheet.getMapTileIndex('CI06_5000_0507')?.bbox ?? [0, 0, 0, 0];
    await fsa.write(fsa.toUrl('memory://pc/chathams.laz'), fakeLasHeader(bbox, { epsg: 3793 }));
    await commandTileIndexValidate.handler({ ...pointCloudArguments, targetEpsg: undefined });
    const fileList: FileListEntryClass[] = await fsa.readJson(
      fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'),
    );
    assert.deepEqual(
      fileList.map((f) => f.output),
      ['CI06_5000_0507'],
    );
  });

  it('should not fail if there are duplicate tiles', async (t) => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    t.mock.method(FileLoader, 'load', () =>
      Promise.resolve(
        [FakeCogTiff.fromTileName('AS21_1000_0101'), FakeCogTiff.fromTileName('AS21_1000_0101')].map(toSource),
      ),
    );

    await commandTileIndexValidate.handler({
      ...baseArguments,
    });
    const outputFileList = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
    assert.deepEqual(outputFileList, [
      {
        output: 'AS21_1000_0101',
        input: ['s3://path/AS21_1000_0101.tiff', 's3://path/AS21_1000_0101.tiff'],
        includeDerived: false,
      },
    ]);
  });

  it('should tile Chatham Islands imagery end to end with no --target-epsg given', async (t) => {
    const chathamTileIndex = ChathamMapSheet.getMapTileIndex('CI06_5000_0507');
    if (chathamTileIndex == null) throw new Error('Failed to compute test fixture tile index');

    const TiffCI06 = new FakeCogTiff('s3://path/CI06_5000_0507.tiff', {
      origin: [chathamTileIndex.origin.x, chathamTileIndex.origin.y],
      size: { width: chathamTileIndex.width, height: chathamTileIndex.height },
      epsg: 3793,
    });
    t.mock.method(FileLoader, 'load', () => Promise.resolve([TiffCI06].map(toSource)));

    await commandTileIndexValidate.handler({
      ...baseArguments,
      targetEpsg: undefined,
      scale: 5000,
    });

    const outputFileList = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/file-list.json'));
    assert.deepEqual(outputFileList, [
      {
        output: 'CI06_5000_0507',
        input: ['s3://path/CI06_5000_0507.tiff'],
        includeDerived: false,
      },
    ]);
  });
});

describe('PointCloudSource', () => {
  it('should fail on a centroid outside the map sheets', () => {
    const header = { source: new URL('memory://pc/a.laz'), version: '1.4', pointFormat: 6, pointCount: 1 };
    const source = new PointCloudSource({ ...header, scale: [0.001, 0.001, 0.001], bbox: [0, 0, 10, 10] });
    assert.throws(() => source.tileNames([0, 0, 10, 10], 5000, MapSheet), /outside the NZTM2000 map sheets/);
  });
});

describe('GridSizeFromString', () => {
  it('should return grid size number', async () => {
    assert.equal(await GridSizeFromString.from('500'), 500);
  });
  it('should throw error when converting invalid grid size', async () => {
    await assert.rejects(
      GridSizeFromString.from('-1'),
      new Error('Invalid grid size "-1"; valid values: "50000", "10000", "5000", "2000", "1000", "500", or "auto"'),
    );
  });
});

describe('validateTiffDataType', () => {
  const dataDir = './src/commands/tileindex-validate/__test__/data';
  it('should be a uint8 TIFF', async () => {
    const testTiff = await createTiff(pathToFileURL(`${dataDir}/8b.tiff`));
    assert.equal(await validateTiffDataType(testTiff, new Set(['uint8'])), 'uint8');
  });
  it('should not be a uint8 TIFF', async () => {
    const testTiff = await createTiff(pathToFileURL(`${dataDir}/16b.tiff`));
    await assert.rejects(validateTiffDataType(testTiff, new Set(['uint8'])), {
      name: 'Error',
      message: `${process.cwd()}/src/commands/tileindex-validate/__test__/data/16b.tiff has unsupported data type: uint16. Expected: uint8`,
    });

    const ret = await validateTiffDataType(testTiff, new Set(['uint16']));
    assert.equal(ret, 'uint16');
  });
  it('should read a float32 TIFF and reject it when only uint8/uint16 are allowed', async () => {
    const testTiff = await createTiff(pathToFileURL(`${dataDir}/32f.tiff`));
    assert.equal(await validateTiffDataType(testTiff, new Set(['float32'])), 'float32');
    await assert.rejects(validateTiffDataType(testTiff, new Set(['uint8', 'uint16'])), {
      name: 'Error',
      message: `${process.cwd()}/src/commands/tileindex-validate/__test__/data/32f.tiff has unsupported data type: float32. Expected: uint8, uint16`,
    });
  });
  it('should read an int16 TIFF and reject it when only uint8/uint16 are allowed', async () => {
    const testTiff = await createTiff(pathToFileURL(`${dataDir}/16i.tiff`));
    assert.equal(await validateTiffDataType(testTiff, new Set(['int16'])), 'int16');
    await assert.rejects(validateTiffDataType(testTiff, new Set(['uint8', 'uint16'])), {
      name: 'Error',
      message: `${process.cwd()}/src/commands/tileindex-validate/__test__/data/16i.tiff has unsupported data type: int16. Expected: uint8, uint16`,
    });
  });
});

describe('validatePreset', () => {
  const dataDir = './src/commands/tileindex-validate/__test__/data';
  async function testValidatePresetTiffs(t: it.TestContext, preset: string): Promise<void> {
    const test8bTiff = await createTiff(pathToFileURL(`${dataDir}/8b.tiff`));
    const test32fTiff = await createTiff(pathToFileURL(`${dataDir}/32f.tiff`));
    const test16iTiff = await createTiff(pathToFileURL(`${dataDir}/16i.tiff`));
    const fatalStub = t.mock.method(logger, 'fatal');
    await assert.rejects(validatePreset(preset, [test8bTiff, test32fTiff, test16iTiff]), {
      name: 'Error',
      message: `Tiff preset:"${preset}" validation failed`,
    });

    assert.equal(fatalStub.mock.callCount(), 2); // Should be called per tiff failure
    const opts = fatalStub.mock.calls[0]?.arguments[0] as Record<string, string>;
    assert.equal(opts['preset'], preset);
    assert.ok(opts['reason']?.includes('unsupported data type'));
  }
  it('should validate multiple tiffs for webp', async (t) => {
    await testValidatePresetTiffs(t, 'webp');
  });
  it('should accept uint16 tiffs for webp', async () => {
    const test16bTiff = await createTiff(pathToFileURL(`${dataDir}/16b.tiff`));
    await assert.doesNotReject(validatePreset('webp', [test16bTiff, test16bTiff]));
  });
  it('should validate multiple tiffs for rgbnir_zstd', async (t) => {
    await testValidatePresetTiffs(t, 'rgbnir_zstd');
  });
  for (const preset of ['webp', 'rgbnir_zstd']) {
    for (const [dataType, file] of [
      ['float32', '32f.tiff'],
      ['int16', '16i.tiff'],
    ]) {
      it(`should reject ${dataType} tiffs for ${preset}`, async (t) => {
        const testTiff = await createTiff(pathToFileURL(`${dataDir}/${file}`));
        const fatalStub = t.mock.method(logger, 'fatal');
        await assert.rejects(validatePreset(preset, [testTiff]), {
          message: `Tiff preset:"${preset}" validation failed`,
        });
        const opts = fatalStub.mock.calls[0]?.arguments[0] as Record<string, string>;
        assert.ok(opts['reason']?.includes(`unsupported data type: ${dataType}`));
      });
    }
  }
});

describe('TiffFromMisalignedTiff', () => {
  it('should properly identify all tiles under a tiff not aligned to our grid', async () => {
    const fakeTiffCover4 = FakeCogTiff.fromTileName('CJ09');
    fakeTiffCover4.images[0].origin[0] -= 10;
    fakeTiffCover4.images[0].origin[1] += 10;
    const fakeTiffCover9 = FakeCogTiff.fromTileName('BA33');
    fakeTiffCover9.images[0].origin[0] -= 10;
    fakeTiffCover9.images[0].origin[1] += 10;
    fakeTiffCover9.images[0].size.width += 100;
    fakeTiffCover9.images[0].size.height += 100;
    const fakeTiffCover3 = FakeCogTiff.fromTileName('BL32');
    fakeTiffCover3.images[0].origin[1] -= 10;
    fakeTiffCover3.images[0].size.height *= 2;
    const locations = await extractLocations([fakeTiffCover4, fakeTiffCover9, fakeTiffCover3].map(toSource), 50000);

    assert.deepEqual(locations[0]?.tileNames, ['CH08', 'CH09', 'CJ08', 'CJ09']);
    assert.deepEqual(locations[1]?.tileNames, ['AZ32', 'AZ33', 'AZ34', 'BA32', 'BA33', 'BA34', 'BB32', 'BB33', 'BB34']);
    assert.deepEqual(locations[2]?.tileNames, ['BL32', 'BM32', 'BN32']);
  });
});

describe('reprojectIfNeeded', () => {
  it('should reproject the bounding box if projections are different', () => {
    const sourceProjection = Projection.get(4326); // WGS84
    const targetProjection = Projection.get(2193); // New Zealand Transverse Mercator 2000
    const bbox: BBox = [172, -41, 174, -38]; // Example bounding box in WGS84

    const reprojectedBbox = reprojectIfNeeded(bbox, sourceProjection, targetProjection) as BBox;
    assert.notDeepEqual(bbox.map(Math.round), reprojectedBbox.map(Math.round)); // expect output to be quite different
    assert.ok(reprojectedBbox);

    const roundtripBbox = reprojectIfNeeded(reprojectedBbox, targetProjection, sourceProjection);
    assert.deepEqual(bbox.map(Math.round), roundtripBbox?.map(Math.round)); // expect output to be very similar (floating point / rounding errors)
  });

  it('should return the same bounding box if projections are the same', () => {
    const sourceProjection = Projection.get(2193); // New Zealand Transverse Mercator 2000
    const targetProjection = Projection.get(2193); // New Zealand Transverse Mercator 2000
    const bbox: BBox = [1, 2, 3, 4]; // Example bounding box

    const reprojectedBbox = reprojectIfNeeded(bbox, sourceProjection, targetProjection);

    assert.deepEqual(reprojectedBbox, bbox);
  });
});

describe('GSD handling', () => {
  const memory = new FsMemory();

  before(() => {
    fsa.register('memory://', memory);
    fsa.register('file:///tmp', memory);
  });
  beforeEach(() => {
    memory.files.clear();
  });

  const baseArguments = {
    config: undefined,
    verbose: false,
    sourceType: 'raster' as const,
    include: undefined,
    validate: false,
    preset: 'none',
    sourceEpsg: undefined,
    sourceVerticalEpsg: undefined,
    targetEpsg: 2193,
    includeDerived: false,
    location: [[fsa.toUrl('memory://test/')]],
    scale: 1000 as GridSize,
    forceOutput: true,
    concurrency: 1,
  };
  const fakeTiff1 = FakeCogTiff.fromTileName('AS21_1000_0101');
  const fakeTiff2 = FakeCogTiff.fromTileName('AT21_1000_0101');
  const fakeTiff3 = FakeCogTiff.fromTileName('AU21_1000_0101');

  it('should fail if GSDs are inconsistent', async (t) => {
    fakeTiff1.images[0].resolution[0] = 1.23;
    fakeTiff2.images[0].resolution[0] = 3.21;
    t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2].map(toSource)));

    const ret = await commandTileIndexValidate
      .handler({
        ...baseArguments,
      })
      .catch((e: Error) => e);
    assert.ok(String(ret).startsWith('Error: Inconsistent GSDs found: '));
  });

  it('should round the GSD to nearest 0.005', async (t) => {
    fakeTiff1.images[0].resolution[0] = 0.5;
    fakeTiff2.images[0].resolution[0] = 0.502499; // within tolerance
    fakeTiff3.images[0].resolution[0] = 0.4975; // within tolerance
    t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2, fakeTiff3].map(toSource)));

    await commandTileIndexValidate.handler(baseArguments);

    const outputGsd = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/gsd'));
    assert.deepEqual(outputGsd, '0.5');
  });

  it(`should not output GSD with unnecessary 0s`, async (t) => {
    for (const val of [1.002, 0.998, 0.9999999999999999, 1.0000000000001]) {
      fakeTiff1.images[0].resolution[0] = Number(val);
      fakeTiff2.images[0].resolution[0] = fakeTiff1.images[0].resolution[0] + 0.0001; // within tolerance
      fakeTiff3.images[0].resolution[0] = fakeTiff1.images[0].resolution[0] - 0.0001; // within tolerance
      console.log(
        `Testing with ${val}`,
        fakeTiff1.images[0].resolution[0],
        fakeTiff2.images[0].resolution[0],
        fakeTiff3.images[0].resolution[0],
      );
      t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2, fakeTiff3].map(toSource)));

      await commandTileIndexValidate.handler(baseArguments);

      const outputGsd = await fsa.readJson(fsa.toUrl('file:///tmp/tile-index-validate/gsd'));
      assert.deepEqual(outputGsd, '1');
    }
  });
});

describe('DataType handling', () => {
  const memory = new FsMemory();

  before(() => {
    fsa.register('memory://', memory);
    fsa.register('file:///tmp', memory);
  });
  beforeEach(() => {
    memory.files.clear();
  });

  const baseArguments = {
    config: undefined,
    verbose: false,
    sourceType: 'raster' as const,
    include: undefined,
    validate: false,
    preset: 'none',
    sourceEpsg: undefined,
    sourceVerticalEpsg: undefined,
    targetEpsg: 2193,
    includeDerived: false,
    location: [[fsa.toUrl('memory://test/')]],
    scale: 1000 as GridSize,
    forceOutput: true,
    concurrency: 1,
  };

  it('should output the data type as its sample-format-qualified name, not the raw bit depth', async (t) => {
    const fakeTiff = FakeCogTiff.fromTileName('AS21_1000_0101');
    t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff].map(toSource)));

    await commandTileIndexValidate.handler(baseArguments);

    const outputDataType = await fsa.read(fsa.toUrl('file:///tmp/tile-index-validate/data-type'));
    assert.strictEqual(outputDataType.toString(), 'uint8');
  });

  it('should fail, naming the failed sources, if no TIFFs yield a data type', async (t) => {
    const fakeTiff1 = FakeCogTiff.fromTileName('AS21_1000_0101');
    const fakeTiff2 = FakeCogTiff.fromTileName('AT21_1000_0101');
    t.mock.method(fakeTiff1.images[0], 'fetch', () => null);
    t.mock.method(fakeTiff2.images[0], 'fetch', () => null);
    t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2].map(toSource)));

    const ret = await commandTileIndexValidate.handler(baseArguments).catch((e: Error) => e);
    assert.ok(String(ret).startsWith('Error: No data types found in the TIFFs: '));
    assert.ok(String(ret).includes('AS21_1000_0101.tiff'));
    assert.ok(String(ret).includes('AT21_1000_0101.tiff'));
  });

  it('should fail if TIFFs have different data types, even when each is allowed by the preset', async (t) => {
    const fakeTiff1 = FakeCogTiff.fromTileName('AS21_1000_0101');
    const fakeTiff2 = FakeCogTiff.fromTileName('AT21_1000_0101');
    t.mock.method(fakeTiff2.images[0], 'fetch', (tag: TiffTag) => {
      if (tag === TiffTag.BitsPerSample) return [16, 16, 16];
      if (tag === TiffTag.SampleFormat) return [SampleFormat.Uint, SampleFormat.Uint, SampleFormat.Uint];
      return null;
    });
    t.mock.method(FileLoader, 'load', () => Promise.resolve([fakeTiff1, fakeTiff2].map(toSource)));

    await assert.rejects(commandTileIndexValidate.handler({ ...baseArguments, preset: 'webp' }), {
      message: 'Inconsistent data types found: uint8, uint16',
    });
  });
});

describe('getSize', () => {
  it('should calculate width and height from bounding box', () => {
    const bbox: BBox = [1000, 2000, 1500, 2800];
    const size = getSize(bbox);
    assert.equal(size.width, 500);
    assert.equal(size.height, 800);
  });

  it('should handle negative coordinates', () => {
    const bbox: BBox = [-1500, -2800, -1000, -2000];
    const size = getSize(bbox);
    assert.equal(size.width, 500);
    assert.equal(size.height, 800);
  });

  it('should handle zero-sized bounding boxes', () => {
    const bbox: BBox = [100, 200, 100, 200];
    const size = getSize(bbox);
    assert.equal(size.width, 0);
    assert.equal(size.height, 0);
  });
});

describe('isTiff', () => {
  it('should return true for .tiff extension', () => {
    const url = new URL('file:///path/to/image.tiff');
    assert.equal(isTiff(url), true);
  });

  it('should return true for .tif extension', () => {
    const url = new URL('file:///path/to/image.tif');
    assert.equal(isTiff(url), true);
  });

  it('should return true for .TIFF extension (case insensitive)', () => {
    const url = new URL('file:///path/to/image.TIFF');
    assert.equal(isTiff(url), true);
  });

  it('should return true for .TIF extension (case insensitive)', () => {
    const url = new URL('file:///path/to/image.TIF');
    assert.equal(isTiff(url), true);
  });

  it('should return false for not a TIFF type extension', () => {
    const url = new URL('file:///path/to/image.ext');
    assert.equal(isTiff(url), false);
  });

  it('should return false for files without extension', () => {
    const url = new URL('file:///path/to/file');
    assert.equal(isTiff(url), false);
  });

  it('should return false for .tiff substring in filename but different extension', () => {
    const url = new URL('file:///path/to/not-a-tiff.jpg');
    assert.equal(isTiff(url), false);
  });
});

describe('determineGridSizeFromGSDPreset', () => {
  // Ancillary Aerial Imagery (preset: 'webp')
  it('returns 1000 for ancillary aerial imagery < 0.1m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.05, 'webp'), 1000);
  });
  it('returns 5000 for ancillary aerial imagery >= 0.1m and < 0.25m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.1, 'webp'), 5000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.249, 'webp'), 5000);
  });
  it('returns 10000 for ancillary aerial imagery >= 0.25m and < 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.25, 'webp'), 10000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.999, 'webp'), 10000);
  });
  it('returns 50000 for ancillary aerial imagery >= 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(1.0, 'webp'), 50000);
    assert.strictEqual(determineGridSizeFromGSDPreset(2.0, 'webp'), 50000);
  });

  // Near-Infrared Aerial Imagery (preset: 'rgbnir_zstd')
  it('returns 1000 for near-infrared aerial imagery < 0.1m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.05, 'rgbnir_zstd'), 1000);
  });
  it('returns 5000 for near-infrared aerial imagery >= 0.1m and < 0.25m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.1, 'rgbnir_zstd'), 5000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.249, 'rgbnir_zstd'), 5000);
  });
  it('returns 10000 for near-infrared aerial imagery >= 0.25m and < 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.25, 'rgbnir_zstd'), 10000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.999, 'rgbnir_zstd'), 10000);
  });
  it('returns 50000 for near-infrared near-infrared aerial imagery >= 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(1.0, 'rgbnir_zstd'), 50000);
    assert.strictEqual(determineGridSizeFromGSDPreset(2.0, 'rgbnir_zstd'), 50000);
  });

  // Ancillary Near-Infrared Aerial Imagery (preset: 'rgbnir_zstd')
  it('returns 1000 for ancillary near-infrared aerial imagery < 0.1m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.05, 'rgbnir_zstd'), 1000);
  });
  it('returns 5000 for ancillary near-infrared aerial imagery >= 0.1m and < 0.25m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.1, 'rgbnir_zstd'), 5000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.249, 'rgbnir_zstd'), 5000);
  });
  it('returns 10000 for ancillary near-infrared aerial imagery >= 0.25m and < 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.25, 'rgbnir_zstd'), 10000);
    assert.strictEqual(determineGridSizeFromGSDPreset(0.999, 'rgbnir_zstd'), 10000);
  });
  it('returns 50000 for ancillary near-infrared aerial imagery >= 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(1.0, 'rgbnir_zstd'), 50000);
    assert.strictEqual(determineGridSizeFromGSDPreset(2.0, 'rgbnir_zstd'), 50000);
  });

  // DEM/DSM/Hillshade (preset: 'dem_lerc')
  it('returns 1000 for elevation < 0.2m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.1, 'dem_lerc'), 1000);
  });
  it('returns 10000 for elevation >= 0.2m and <= 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(0.2, 'dem_lerc'), 10000);
    assert.strictEqual(determineGridSizeFromGSDPreset(1.0, 'dem_lerc'), 10000);
  });
  it('returns 50000 for elevation > 1.0m', () => {
    assert.strictEqual(determineGridSizeFromGSDPreset(1.01, 'dem_lerc'), 50000);
    assert.strictEqual(determineGridSizeFromGSDPreset(2.0, 'dem_lerc'), 50000);
  });

  it('throws error for unknown preset', () => {
    assert.throws(() => determineGridSizeFromGSDPreset(0.5, 'unknown'), /Unknown preset/);
  });
});
