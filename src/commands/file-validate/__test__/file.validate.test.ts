import o from 'ospec';
import { findDuplicates, getTileName, roundWithCorrection } from '../file.validate.js';
import { duplicatesInput, duplicatesOutput, mapSheetData, noDuplicatesInput } from './file.validate.data.js';

o('roundWithCorrectionValid1', async function () {
  o(roundWithCorrection(1643679.999967818148434)).equals(1643680);
});
o('roundWithCorrectionValid2', async function () {
  o(roundWithCorrection(1643679.99)).equals(1643680);
});
o('roundWithCorrectionValid3', async function () {
  o(roundWithCorrection(1643680.01)).equals(1643680);
});
o('roundWithCorrectionValid4', async function () {
  o(roundWithCorrection(1643680.05)).equals(1643680.05);
});
o('roundWithCorrectionValid5', async function () {
  o(roundWithCorrection(1643679.969)).equals(1643679.97);
});
o('roundWithCorrectionValid6', async function () {
  o(roundWithCorrection(5444160.051)).equals(5444160.05);
});
o('roundWithCorrectionValid7', async function () {
  o(roundWithCorrection(5444160.015)).equals(5444160);
});
o('roundWithCorrectionValid8', async function () {
  o(roundWithCorrection(5444160.985)).equals(5444161);
});
o('alignmentGeneratesCorrectName', async function () {
  o(getTileName([1236640, 4837560], 500)).equals('CG10_500_080037');
});
o('alignmentGeneratesCorrectNameWithDrift', async function () {
  o(getTileName([1643679.999967818148434, 5444159.999954843893647], 1000)).equals('BP27_1000_4817');
});
o('alignmentBuildsCorrectSheetCode', async function () {
  mapSheetData.forEach(function (f) {
    o(getTileName([f.origin.x, f.origin.y], 500).split('_')[0]).equals(f.code);
  });
});
o('InvalidOriginException1', function () {
  o(() => {
    getTileName([1643679, 5444159.01535345], 1000);
  }).throws(Error);
});
o('InvalidOriginException2', function () {
  o(() => {
    getTileName([1643679.984567, 5444159], 1000);
  }).throws(Error);
});
o('FindDuplicates', async function () {
  o(findDuplicates(duplicatesInput)).deepEquals(duplicatesOutput);
});
o('FindNoDuplicates', async function () {
  o(findDuplicates(noDuplicatesInput)).deepEquals([]);
});
