import o from 'ospec';
import { TiffLoader, commandTileIndexValidate, extractTiffLocations, getTileName, groupByTileName } from '../tileindex.validate.js';
import { TiffAs21, TiffAs21In3857, TiffAy29 } from './tileindex.validate.data.js';
import { MapSheet } from '../../../utils/mapsheet.js';
import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import { createSandbox} from 'sinon';
import { CogTiff } from '@cogeotiff/core/build/cog.tiff.js';


function convertTileName(x: string, scale: number): string | null {
  const extract = MapSheet.extract(x);
  if (extract == null) return null;
  return getTileName(extract.bbox[0], extract.bbox[3], scale)
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
  })

  o('should get correct parent tile 1:10k', () => {
    o(convertTileName('CH11_1000_0101', 10000)).equals('CH11_10000_0101');
    o(convertTileName('CH11_1000_0110', 10000)).equals('CH11_10000_0101');
    o(convertTileName('CH11_1000_1010', 10000)).equals('CH11_10000_0101');
    o(convertTileName('CH11_1000_1001', 10000)).equals('CH11_10000_0101');
  });
})

// o.spec('findDuplicates', () => {
//   o('should find duplicates', async () => {
//     o(JSON.stringify(groupByTileName(DuplicateInput))).equals(JSON.stringify(DuplicateOutput));
//   });
// });

o.spec('tiffLocation', () => {
  o('get location from tiff', async () => {
    const location = await extractTiffLocations([TiffAs21, TiffAy29], 1000)
    o(location[0]?.tileName).equals('AS21_1000_0101')
    o(location[1]?.tileName).equals('AY29_1000_0101')
  });

  o('should find duplicates', async () => {
    const location = await extractTiffLocations([TiffAs21, TiffAy29, TiffAs21, TiffAy29], 1000)
    const duplicates = groupByTileName(location);
    o(duplicates.get('AS21_1000_0101')?.map(c => c.source)).deepEquals(['s3://test-as21', 's3://test-as21'])
    o(duplicates.get('AY29_1000_0101')?.map(c => c.source)).deepEquals(['s3://test-ay29', 's3://test-ay29'])
  })

  o('should find tiles from 3857', async () => {
    const location = await extractTiffLocations([TiffAs21In3857], 1000)
    o(location[0]?.tileName).equals('AS21_1000_0101')
  })
});


o.spec('validate', () => {
  const memory = new FsMemory()
  const sandbox = createSandbox();

  o.before(() => {
    fsa.register('/tmp', memory)
  })
  o.beforeEach(() => memory.files.clear())
  o.afterEach(() => sandbox.restore());

  o('should fail if duplicate tiles are detected', async () => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    const stub = sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([TiffAs21, TiffAs21]))

    try {
      await commandTileIndexValidate.handler({ location: ['s3://test'], retile: false, validate:true, scale: 1000, forceOutput: true } as any);
    } catch (e) {
      o(String(e)).equals('Error: Duplicate files found, see output.geojson')
    }

    o(stub.callCount).equals(1);
    o(stub.args?.[0]?.[0]).deepEquals(['s3://test']);

    const outputFileList:GeoJSON.FeatureCollection = await fsa.readJson('/tmp/tile-index-validate/output.geojson')
    o(outputFileList.features.length).equals(1);
    const firstFeature = outputFileList.features[0];
    o(firstFeature?.properties?.['tileName']).equals('AS21_1000_0101')
    o(firstFeature?.properties?.['source']).deepEquals([TiffAs21.source.uri, TiffAs21.source.uri])
  })

  o('should not fail if duplicate tiles are detected but --retile is used', async () => {
    // Input source/a/AS21_1000_0101.tiff source/b/AS21_1000_0101.tiff
    sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([TiffAs21, TiffAs21]))

    await commandTileIndexValidate.handler({ location: ['s3://test'], retile: true, scale: 1000, forceOutput: true } as any);
    const outputFileList = await fsa.readJson('/tmp/tile-index-validate/file-list.json')
    o(outputFileList).deepEquals([{ output: 'AS21_1000_0101', input: [TiffAs21.source.uri, TiffAs21.source.uri] }])
  })

  // B
  o.only('should fail if input tiff\'s origin is offset by Xm', async () => {
    // Input AS21_1000_0101.tiff offset by +0.xm 
    // Input AS21_1000_0101.tiff offset by -0.xm
    // const tiffClone = structuredClone({ buffer: new Buffer() }, { transfer: [valueGeo]});
    const tiffClone = cloneTiff(TiffAs21);
    tiffClone.images[0].origin = [tiffClone.images[0].origin[0] - 0.05, tiffClone.images[0].origin[1]];
    sandbox.stub(TiffLoader, 'load').returns(Promise.resolve([tiffClone]))
    await commandTileIndexValidate.handler({ location: ['s3://test'], retile: true, validate: true, scale: 1000, forceOutput: true } as any);

    // TiffAs21.images[0]!.origin = [TiffAs21.images[0].origin[0] - 0.015, TiffAs21.images[0].origin[1]  ]


  })


  // C
  // TODO should this have the same +- 0.015m as the origin check
  o('should fail if input tiff is larger width or height', () => {
    // Input AS21_1000_0101.tiff width/height by +1m => 
    // 720x480 => 721x480 
    // 720x481 => 720x481
    // 721x481 => 721x481

    //tiffClone.images[0].size.width = 721;

    // Input AS21_1000_0101.tiff height/height by -1m
    // 720x480 => 719x480 
    // 720x481 => 720x479
    // 721x481 => 719x479

  })
})
// 
// o.spec('retile', () => {
// 
// })


function cloneTiff(tiff:CogTiff): CogTiff {
  const tiffClone = JSON.parse(JSON.stringify(tiff));
  tiffClone.images[0].valueGeo = () => null;
  return tiffClone as CogTiff;
}

o.run();