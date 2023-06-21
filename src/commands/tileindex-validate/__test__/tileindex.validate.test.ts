import o from 'ospec';
import { MapSheetData } from '../../../utils/__test__/mapsheet.data.js';
import { findDuplicates, getTileName, roundWithCorrection } from '../tileindex.validate.js';
import { DuplicateInput, DuplicateOutput } from './tileindex.validate.data.js';

o.spec('roundWithCorrectionValid', () => {
  o('should round up (15 decimal places)', async () => {
    o(roundWithCorrection(1643679.999967818148434)).equals(1643680);
  });
  o('Should round up (2 decimal places)', async () => {
    o(roundWithCorrection(1643679.99)).equals(1643680);
  });
  o('should round down', async () => {
    o(roundWithCorrection(1643680.01)).equals(1643680);
  });
  o('.05 should not round', async () => {
    o(roundWithCorrection(1643680.05)).equals(1643680.05);
  });
  o('Should round to 2 decimal places (.969 to .97)', async () => {
    o(roundWithCorrection(1643679.969)).equals(1643679.97);
  });
  o('Should round to 2 decimal places (.051 to .05)', async () => {
    o(roundWithCorrection(5444160.051)).equals(5444160.05);
  });
  o('Should round down to whole number', async () => {
    o(roundWithCorrection(5444160.015)).equals(5444160);
  });
  o('Should round up to whole number', async () => {
    o(roundWithCorrection(5444160.985)).equals(5444161);
  });
});

o.spec('getTileName', () => {
  o('should generate correct name', async () => {
    o(getTileName([1236640, 4837560], 500)).equals('CG10_500_080037');
  });
  o('should generate correct name with drift', async () => {
    o(getTileName([1643679.999967818148434, 5444159.999954843893647], 1000)).equals('BP27_1000_4817');
  });
  o('should guilds correct sheet code', async () => {
    for (const f of MapSheetData) {
      o(getTileName([f.origin.x, f.origin.y], 500).split('_')[0]).equals(f.code);
    }
  });
  o('Should throw error for Invalid Origin', () => {
    o(() => {
      getTileName([1643679, 5444159.01535345], 1000);
    }).throws(Error);
  });
  o('Should also throw error for Invalid Origin', () => {
    o(() => {
      getTileName([1643679.984567, 5444159], 1000);
    }).throws(Error);
  });
});

o.spec('findDuplicates', () => {
  o('should find duplicates', async () => {
    o(JSON.stringify(findDuplicates(DuplicateInput))).equals(JSON.stringify(DuplicateOutput));
  });


//   o('should throw if imagery is not in ESPG:2193', () => {
//     const brokenImages = [
//       { source: { uri: 's3://test-path-one' }, images: [{ origin: [1492000, 6234000], epsg: 3857 }] },
//     ] as unknown as CogTiff[];
//     o(() => findDuplicates(brokenImages, 1000)).throws(Error);
//   });
});
