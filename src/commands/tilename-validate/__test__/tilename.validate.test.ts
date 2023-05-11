import o from 'ospec';
import { MapSheetData } from '../../../utils/__test__/mapsheet.data.js';
import { findDuplicates, getTileName, roundWithCorrection } from '../tilename.validate.js';
import { DuplicateInput, DuplicateOutput, NoDuplicateInput } from './tilename.validate.data.js';
// o.spec('createManifest', () => {

o.spec('roundWithCorrectionValid', () => {
  o('should round up (15 decimal places)', async () => {
    o(roundWithCorrection(1643679.999967818148434)).equals(1643680);
  });
  o('Should round up (2 decimal places)', async () => {
    o(roundWithCorrection(1643679.99)).equals(1643680);
  });
  o('should round down', async function () {
    o(roundWithCorrection(1643680.01)).equals(1643680);
  });
  o('.05 should not round', async function () {
    o(roundWithCorrection(1643680.05)).equals(1643680.05);
  });
  o('Should round to 2 decimal places (.969 to .97)', async function () {
    o(roundWithCorrection(1643679.969)).equals(1643679.97);
  });
  o('Should round to 2 decimal places (.051 to .05)', async function () {
    o(roundWithCorrection(5444160.051)).equals(5444160.05);
  });
  o('Should round down to whole number', async function () {
    o(roundWithCorrection(5444160.015)).equals(5444160);
  });
  o('Should round up to whole number', async function () {
    o(roundWithCorrection(5444160.985)).equals(5444161);
  });
});

o('alignmentGeneratesCorrectName', async function () {
  o(getTileName([1236640, 4837560], 500)).equals('CG10_500_080037');
});
o('alignmentGeneratesCorrectNameWithDrift', async function () {
  o(getTileName([1643679.999967818148434, 5444159.999954843893647], 1000)).equals('BP27_1000_4817');
});
o('alignmentBuildsCorrectSheetCode', async function () {
  MapSheetData.forEach(function (f) {
    o(getTileName([f.origin.x, f.origin.y], 500).split('_')[0]).equals(f.code);
  });
});

o.spec('InvalidOriginException', () => {
  o('Should throw error for Invalid Origin', function () {
    o(() => {
      getTileName([1643679, 5444159.01535345], 1000);
    }).throws(Error);
  });
  o('Also Should throw error for Invalid Origin', function () {
    o(() => {
      getTileName([1643679.984567, 5444159], 1000);
    }).throws(Error);
  });
});

o('findDuplicates', async function () {
  o(findDuplicates(DuplicateInput, 1000)).deepEquals(DuplicateOutput);
});
o('findNoDuplicates', async function () {
  o(findDuplicates(NoDuplicateInput, 1000)).deepEquals([]);
});
