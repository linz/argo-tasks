import o from 'ospec';
import { extractTiffLocations, getTileName, groupByTileName } from '../tileindex.validate.js';
import { DuplicateInput, DuplicateOutput, TiffAs21, TiffAs21In3857, TiffAy29 } from './tileindex.validate.data.js';
import { MapSheet } from '../../../utils/mapsheet.js';

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


o.run();