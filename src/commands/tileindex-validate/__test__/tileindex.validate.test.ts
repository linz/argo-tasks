import o from 'ospec';
//import { MapSheetData } from '../../../utils/__test__/mapsheet.data.js';
import { extractTiffLocations, getTileName, groupByTileName } from '../tileindex.validate.js';
import { DuplicateInput, DuplicateOutput, TiffAs21, TiffAy29 } from './tileindex.validate.data.js';
import { MapSheet } from '../../../utils/mapsheet.js';
// import { CogTiff } from '@cogeotiff/core';


o.spec('getTileName', () => {
  o('should generate correct name', async () => {
    o(getTileName(1236640, 4837560, 500)).equals('CG10_500_080037');
  });
  // o('should generate correct name with drift', async () => {
  //   o(getTileName(1643679.999967818148434, 5444159.999954843893647, 1000)).equals('BP27_1000_4817');
  // });
  // o('should guilds correct sheet code', async () => {
  //   for (const f of MapSheetData) {
  //     o(getTileName(f.origin.x, f.origin.y, 500).split('_')[0]).equals(f.code);
  //   }
  // });
  // o('Should throw error for Invalid Origin', () => {
  //   o(() => {
  //     getTileName(1643679, 5444159.01535345, 1000);
  //   }).throws(Error);
  // });
  // o('Should also throw error for Invalid Origin', () => {
  //   o(() => {
  //     getTileName(1643679.984567, 5444159, 1000);
  //   }).throws(Error);
  // });
});

function convertTileName(x: string, scale: number): string | null {
  const extract = MapSheet.extract(x);
  if (extract == null) return null;
  return getTileName(extract.bbox[0], extract.bbox[3], scale)
}

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
  // o(getTileName(MapSheet.extract('CH11_1000_0101')?.bbox!, 5000)).equals('CH11_10000_0101')

  o(convertTileName('CH11_1000_0101', 10000)).equals('CH11_10000_0101');
  o(convertTileName('CH11_1000_0110', 10000)).equals('CH11_10000_0101');
  o(convertTileName('CH11_1000_1010', 10000)).equals('CH11_10000_0101');
  o(convertTileName('CH11_1000_1001', 10000)).equals('CH11_10000_0101');
});


o.spec('findDuplicates', () => {
  o('should find duplicates', async () => {
    o(JSON.stringify(groupByTileName(DuplicateInput))).equals(JSON.stringify(DuplicateOutput));
  });
});

// o('should throw if imagery is not in ESPG:2193', () => {
//   const brokenImages = [
//     { source: { uri: 's3://test-path-one' }, images: [{ origin: [1492000, 6234000], epsg: 3857 }] },
//   ] as unknown as CogTiff[];
//   o(() => groupByTileName(brokenImages. 1000)).throws(Error);
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

  // o('should find tiles from 3857', async () => {
  //   const location = await extractTiffLocations([TiffAs21In3857], 1000)
  //   o(location[0]?.tileName).equals('AS21_1000_0101')
  // })
});


o.run();