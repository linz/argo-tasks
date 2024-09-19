import { gzipSync } from 'node:zlib';

import { ConfigTileSetRaster } from '@basemaps/config';
import { EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { command, number, option, optional, string } from 'cmd-ts';
import pLimit from 'p-limit';
import { basename } from 'path/posix';
import pc from 'polygon-clipping';
import { StacCollection, StacItem } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { hashStream } from '../../utils/hash.js';
import { MapSheet } from '../../utils/mapsheet.js';
import { config, registerCli, tryParseUrl, Url, UrlFolder, urlToString, verbose } from '../common.js';
import { getPacificAucklandYearMonthDay } from '../path/path.date.js';

/** Datasets to skip */
const Skip = new Set([
  /** This covers the entire country and can be ignored */
  'new-zealand_2012_dem_8m',
]);

/** allow the configuration layer choice between 2193 and 3857 */
const ValidCodes = new Set([EpsgCode.Google, EpsgCode.Nztm2000]);

export const commandMapSheetCoverage = command({
  name: 'mapsheet-coverage',
  description: 'Create a list of mapsheets needing to be created from a basemaps configuration',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    epsgCode: option({
      type: number,
      long: 'epsg-code',
      description: 'Basemaps configuration layer ESPG code to use',
      defaultValueIsSerializable: true,
      defaultValue: () => EpsgCode.Nztm2000,
    }),
    location: option({
      type: Url,
      long: 'location',
      description: 'Location of the basemaps configuration file',
      defaultValueIsSerializable: true,
      defaultValue: () => {
        return new URL('https://raw.githubusercontent.com/linz/basemaps-config/master/config/tileset/elevation.json');
      },
    }),
    mapSheet: option({
      type: optional(string),
      long: 'mapsheet',
      description: 'Limit the output to a specific mapsheet eg "BX01"',
    }),
    compare: option({
      type: optional(string),
      long: 'compare',
      description: 'Compare the output with an existing combined collection.json',
    }),
    output: option({
      type: optional(UrlFolder),
      long: 'output',
      description: 'Where to store output files',
      defaultValueIsSerializable: true,
      defaultValue: () => tryParseUrl('/tmp/mapsheet-coverage/'),
    }),
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('MapSheetCoverage:Start');

    if (!ValidCodes.has(args.epsgCode)) {
      logger.error({ epsgCode: args.epsgCode }, 'Invalid:EpsgCode');
      return;
    }

    if (args.compare && !args.compare.endsWith('collection.json')) {
      logger.error('--compare must compare with an existing STAC collection.json');
      return;
    }

    const config = await fsa.readJson<ConfigTileSetRaster>(urlToString(args.location));

    // All the layers' capture areas with some additional metadata
    const allLayers = { type: 'FeatureCollection', features: [] as GeoJSON.Feature[] };

    // All previous capture area features restricted to the area needed for the output
    const captureDates = { type: 'FeatureCollection', features: [] as GeoJSON.Feature[] };

    // All the coordinates currently used
    let layersCombined: pc.MultiPolygon[] = [];

    // MapSheetName to List of source files required
    const mapSheets = new Map<string, string[]>();

    // Reverse the configuration so the highest priority datasets come first
    for (const layer of config.layers.reverse()) {
      if (Skip.has(layer.name)) continue;

      const layerSource = layer[args.epsgCode as 2193 | 3857];
      if (layerSource == null) {
        logger.warn({ layer: layer.name, layerSource: args.epsgCode }, 'Layer:Missing');
        continue;
      }

      const targetCollection = new URL('collection.json', layerSource);
      const collection = await fsa.readJson<StacCollection>(targetCollection.href);

      // Capture area is the area where this layer has data for
      const captureAreaLink = collection.assets?.['capture_area'];
      if (captureAreaLink == null) throw new Error('Missing capture area :' + targetCollection.href);
      const targetCaptureAreaUrl = new URL(captureAreaLink.href, targetCollection.href);

      const captureArea = await fsa.readJson<GeoJSON.Feature>(targetCaptureAreaUrl.href);

      // As these times are mostly made up, convert them into NZ time to prevent
      // flown years being a year off when the interval is 2023-12-31T12:00:00.000Z (or Jan 1st NZT)
      const [flownFrom, flownTo] = collection.extent.temporal.interval[0].map(getPacificAucklandYearMonthDay);

      // Propagate properties from the source STAC collection into the capture area geojson
      captureArea.properties = captureArea.properties ?? {};
      captureArea.properties['title'] = collection.title;
      captureArea.properties['description'] = collection.description;
      captureArea.properties['id'] = collection.id;
      captureArea.properties['license'] = collection.license;
      captureArea.properties['providers'] = collection.providers;
      captureArea.properties['source'] = targetCollection.href;
      captureArea.properties['flown_from'] = flownFrom;
      captureArea.properties['flown_to'] = flownTo;

      for (const [key, value] of Object.entries(collection)) {
        if (key.startsWith('linz:')) captureArea.properties[key] = value;
      }

      logger.debug(
        {
          layer: layer.name,
          title: collection.title,
          layerSizeBytes: JSON.stringify(captureArea.geometry).length,
        },
        'Processing',
      );

      // GeoJSON over about 8 decimal places starts running into floating point math errors
      truncateGeoJson(captureArea);

      // Determine if this layer has any additional information to the existing layers
      const diff = pc.difference(captureArea.geometry.coordinates as pc.MultiPolygon, layersCombined);

      // Layer has no information included in the output
      if (diff.length === 0) {
        logger.warn({ layer: layer.name, location: targetCaptureAreaUrl.href }, 'FullyCovered');
        const outputPath = new URL(`remove-${layer.name}.geojson`, args.output);
        await fsa.write(urlToString(outputPath), JSON.stringify(captureArea));
        continue;
      }

      // Extract all the links from the collection and assign them to each mapsheet
      // This assumes that tiles are in the format "./BX01_1000_0101.json"
      for (const link of collection.links) {
        if (link.rel !== 'item') continue;
        const url = new URL(link.href, targetCollection);
        const fileName = basename(url.pathname);

        const ms = MapSheet.getMapTileIndex(fileName);
        if (ms == null) throw new Error('Unable to extract mapsheet from ' + url.href);

        // Limit the output to only the requested mapsheet
        if (args.mapSheet && args.mapSheet !== ms.mapSheet) continue;

        const existing = mapSheets.get(ms.mapSheet) ?? [];
        // TODO this is not the safest way of getting access to the tiff, it would be best to load the stac item
        existing.unshift(url.href.replace('.json', '.tiff'));
        mapSheets.set(ms.mapSheet, existing);
      }

      layersCombined = pc.union(layersCombined, captureArea.geometry.coordinates as pc.MultiPolygon);
      captureDates.features.push({
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: diff },
        properties: captureArea.properties,
      });
      allLayers.features.push(captureArea);
    }

    // All the source layers as a single file
    logger.info('Write:SourceFeatures');
    const sourceFeaturePath = new URL('layers-source.geojson.gz', args.output);
    await fsa.write(urlToString(sourceFeaturePath), gzipSync(JSON.stringify(allLayers)));

    // A single output feature for total capture area
    logger.info('Write:CombinedUnion');
    const combinedPath = new URL('layers-source.geojson.gz', args.output);
    await fsa.write(
      urlToString(combinedPath),
      gzipSync(JSON.stringify({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: layersCombined } })),
    );

    // Which areas of each layers are needed for the output, this should be uncompressed to make it easier to be consumed and viewed
    logger.info('Write:RequiredLayers');
    const captureDatesPath = new URL('capture-dates.geojson', args.output);
    await fsa.write(urlToString(captureDatesPath), JSON.stringify(captureDates));

    if (args.compare) {
      const sheetsToSkip = await compareCreation(args.compare, mapSheets);
      if (sheetsToSkip.length > 0) {
        logger.info({ sheetsToSkip }, 'MapSheetCoverage:Skip');
        for (const sheet of sheetsToSkip) mapSheets.delete(sheet);
      }
    }

    // List of files to be created
    const todo = [...mapSheets].map((m) => {
      return { output: `${m[0]}`, input: m[1], includeDerived: true };
    });

    const fileListPath = new URL('file-list.json', args.output);
    await fsa.write(urlToString(fileListPath), JSON.stringify(todo));
    logger.info(
      {
        duration: performance.now() - startTime,
        layersFound: allLayers.features.length,
        layersNeeded: captureDates.features.length,
        itemsToCreate: todo.length,
      },
      'MapSheetCoverage:Done',
    );
  },
});

async function compareCreation(
  compareLocation: string,
  mapSheets: Map<string, string[]>,
  hashQueueLength = 25,
): Promise<string[]> {
  logger.info({ compareTo: compareLocation, mapSheetCount: mapSheets.size }, 'MapSheetCoverage:Compare');

  // Limit the number of files hashing concurrently
  const hashQueue = pLimit(hashQueueLength);

  // Joining STAC document locations as file paths can be tricky, use the built in URL lib to handle the joins
  const compareUrl = tryParseUrl(compareLocation);

  const collectionJson = await fsa.readJson<StacCollection>(compareLocation);

  // List of mapsheets that are the same as the compare location
  const sheetsToSkip: string[] = [];

  for (const [sheetCode, sourceFiles] of mapSheets) {
    const itemLink = collectionJson.links.find((f) => f.href.endsWith(sheetCode + '.json'));

    // Mapsheet does not exist in current collection json, it is new file to be created
    if (itemLink == null) {
      logger.info({ sheetCode: sheetCode, sourceFiles: sourceFiles.length }, 'MapSheetCoverage:Compare:New');
      continue;
    }
    const itemJson = await fsa.readJson<StacItem>(urlToString(new URL(itemLink.href, compareUrl)));

    const derivedFrom = itemJson.links.filter((f) => f.rel === 'derived_from');
    // Difference in the number of files needed to create this mapsheet, so it needs to be recreated
    if (derivedFrom.length !== sourceFiles.length) {
      logger.debug(
        { sheetCode: sheetCode, sourceLocations: sourceFiles, oldLocations: derivedFrom.map((m) => m.href) },
        'MapSheetCoverage:difference',
      );
      continue;
    }

    let needsToBeCreated = false;
    await Promise.all(
      derivedFrom.map(async (item, index) => {
        // A difference has already been found skip checking the rest of the checksums
        if (needsToBeCreated) return;

        const sourceFile = sourceFiles[index];
        if (sourceFile == null || item.href !== sourceFile.replace('.tiff', '.json')) {
          logger.debug({ sheetCode, source: item.href }, 'MapSheetCoverage:Compare:source-difference');
          needsToBeCreated = true;
          return;
        }

        // No checksum found in source collection link, force re-create the file
        if (item['file:checksum'] == null) {
          logger.warn({ sheetCode, source: item.href }, 'MapSheetCoverage:Compare:source-checksum-missing');
          needsToBeCreated = true;
          return;
        }

        // TODO: to improve performance further we could use the source collection.json as it contains all the item checksums
        const sourceItemHash = await hashQueue(() => hashStream(fsa.stream(item.href)));
        logger.trace(
          { source: item.href, hash: sourceItemHash, isOk: sourceItemHash === item['file:checksum'] },
          'MapSheetCoverage:Compare:checksum',
        );

        if (sourceItemHash !== item['file:checksum']) {
          logger.debug(
            { sheetCode, source: item.href, sourceItemHash },
            'MapSheetCoverage:Compare:source-checksum-difference',
          );
          needsToBeCreated = true;
          return;
        }
      }),
    );

    // No changes found, item can be removed
    if (needsToBeCreated === false) sheetsToSkip.push(sheetCode);
  }

  return sheetsToSkip;
}
