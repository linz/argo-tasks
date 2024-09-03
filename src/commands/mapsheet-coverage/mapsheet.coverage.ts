import { writeFileSync } from 'node:fs';
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
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { hashBuffer, hashStream } from '../../utils/hash.js';
import { MapSheet } from '../../utils/mapsheet.js';
import { config, registerCli, tryParseUrl, urlToString, verbose } from '../common.js';

/** Datasets to skip */
const Skip = new Set([
  /** This covers the entire country and can be ignored */
  'new-zealand_2012_dem_8m',
]);

/** Location for the output files to be stored */
const OutputPath = '/tmp/mapsheet-coverage/';

/**
 * Number of decimal places to restrict capture areas to
 * Rough numbers of decimal places to precision in meters
 *
 * 5DP - 1m
 * 6DP - 0.1m
 * 7DP - 0.01m (1cm)
 * 8DP - 0.001m (1mm)
 */
const TruncationFactor = 8;

/**
 * Truncate a multi polygon in lat,lng to {@link TruncationFactor} decimal places
 *
 * @warning This destroys the source geometry
 * @param polygons
 */
function truncateGeoJson(feature: GeoJSON.Feature): asserts feature is GeoJSON.Feature<GeoJSON.MultiPolygon> {
  const factor = Math.pow(10, TruncationFactor);

  const geom = feature.geometry;
  // force polygons to be multipolygons
  if (geom.type === 'Polygon') feature.geometry = { type: 'MultiPolygon', coordinates: [geom.coordinates] };

  // Only multipolygons can be truncated
  if (feature.geometry.type !== 'MultiPolygon') throw new Error('Unable to truncate: ' + feature.geometry?.type);

  const multiPoly = feature.geometry;

  for (const poly of multiPoly.coordinates) {
    for (const ring of poly) {
      for (const pt of ring) {
        pt[0] = Math.round(pt[0]! * factor) / factor;
        pt[1] = Math.round(pt[1]! * factor) / factor;
      }
    }
  }
}

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
      type: string,
      long: 'location',
      description: 'Location of the basemaps configuration file',
      defaultValueIsSerializable: true,
      defaultValue: () => 'https://raw.githubusercontent.com/linz/basemaps-config/master/config/tileset/elevation.json',
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
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('MapSheet:Start');

    if (!ValidCodes.has(args.epsgCode)) {
      logger.error({ epsgCode: args.epsgCode }, 'Invalid:EpsgCode');
      return;
    }

    if (args.compare && !args.compare.endsWith('collection.json')) {
      logger.error('--compare must compare with an existing STAC collection.json');
      return;
    }

    const config = await fsa.readJson<ConfigTileSetRaster>(args.location);

    /** All the layers' capture areas with some additional metadata */
    const allLayers = { type: 'FeatureCollection', features: [] as GeoJSON.Feature[] };

    // All previous capture area features restricted to the area needed for the output
    const layersRequired = { type: 'FeatureCollection', features: [] as GeoJSON.Feature[] };

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
      // Propagate properties from the source STAC collection into the capture area geojson
      captureArea.properties = captureArea.properties ?? {};
      captureArea.properties['source'] = targetCaptureAreaUrl.href;
      captureArea.properties['title'] = collection.title;
      for (const [key, value] of Object.entries(collection)) {
        if (key.startsWith('linz:')) captureArea.properties[key] = value;
      }
      logger.debug(
        {
          layer: layer.name,
          title: collection.title,
          layerSizeBytes: Math.round(JSON.stringify(captureArea.geometry).length),
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
        await fsa.write(fsa.join(OutputPath, `remove-${layer.name}.geojson`), JSON.stringify(captureArea));
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
        // TODO this is not the safest way of getting access to the tiff, it would be best to load
        existing.unshift(url.href.replace('.json', '.tiff'));
        mapSheets.set(ms.mapSheet, existing);
      }

      layersCombined = pc.union(layersCombined, captureArea.geometry.coordinates as pc.MultiPolygon);
      layersRequired.features.push({
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: diff },
        properties: captureArea.properties,
      });
      allLayers.features.push(captureArea);
    }

    // All the source layers as a single file
    logger.info('Write:SourceFeatures');
    await fsa.write(fsa.join(OutputPath, 'layers-source.geojson.gz'), gzipSync(JSON.stringify(allLayers)));

    // A single output feature for total capture area
    logger.info('Write:CombinedUnion');
    await fsa.write(
      fsa.join(OutputPath, 'layers-combined.geojson.gz'),
      gzipSync(JSON.stringify({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: layersCombined } })),
    );

    // Which areas of each layers are needed for the output
    logger.info('Write:RequiredLayers');
    await fsa.write(fsa.join(OutputPath, 'layers-required.geojson.gz'), gzipSync(JSON.stringify(layersRequired)));

    if (args.compare) {
      const sheetsToSkip = await compareCreation(args.compare, mapSheets);
      if (sheetsToSkip.length > 0) {
        logger.info({ sheetsToSkip }, 'MapSheet:Skip');
        for (const sheet of sheetsToSkip) mapSheets.delete(sheet);
      }
    }

    // List of files to be created
    const todo = [...mapSheets].map((m) => {
      return { output: `${m[0]}`, input: m[1], includeDerived: true };
    });

    await fsa.write(fsa.join(OutputPath, 'file-list.json'), JSON.stringify(todo));
    logger.info(
      {
        duration: performance.now() - startTime,
        layersFound: allLayers.features.length,
        layersNeeded: layersRequired.features.length,
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
  logger.info({ compareTo: compareLocation, mapSheetCount: mapSheets.size }, 'MapSheet:Compare');

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
      logger.info({ sheetCode: sheetCode, sourceFiles: sourceFiles.length }, 'MapSheet:Compare:New');
      continue;
    }
    const itemJson = await fsa.readJson<StacItem>(urlToString(new URL(itemLink.href, compareUrl)));

    const derivedFrom = itemJson.links.filter((f) => f.rel === 'derived_from');
    // Difference in the number of files needed to create this mapsheet, so it needs to be recreated
    if (derivedFrom.length !== sourceFiles.length) {
      logger.debug(
        { sheetCode: sheetCode, sourceLocations: sourceFiles, oldLocations: derivedFrom.map((m) => m.href) },
        'mapsheet:difference',
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
          logger.debug({ sheetCode, source: item.href }, 'MapSheet:Compare:source-difference');
          needsToBeCreated = true;
          return;
        }

        // No checksum found in source collection link, force re-create the file
        if (item['file:checksum'] == null) {
          logger.warn({ sheetCode, source: item.href }, 'MapSheet:Compare:source-checksum-missing');
          needsToBeCreated = true;
          return;
        }

        // TODO: to improve performance further we could use the source collection.json as it contains all the item checksums
        const sourceItemHash = await hashQueue(() => hashStream(fsa.stream(item.href)));
        logger.trace(
          { source: item.href, hash: sourceItemHash, isOk: sourceItemHash === item['file:checksum'] },
          'MapSheet:Compare:checksum',
        );

        if (sourceItemHash !== item['file:checksum']) {
          logger.debug({ sheetCode, source: item.href, sourceItemHash }, 'MapSheet:Compare:source-checksum-difference');
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
