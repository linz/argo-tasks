import { gzipSync } from 'node:zlib';

import { ConfigTileSetRaster } from '@basemaps/config';
import { EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { command, number, option, optional, string } from 'cmd-ts';
import { basename } from 'path/posix';
import pc from 'polygon-clipping';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { MapSheet } from '../../utils/mapsheet.js';
import { config, registerCli, verbose } from '../common.js';

/** Datasets to skip */
const Skip = new Set([
  /** This covers the entire country and can be ignored */
  'new-zealand_2012_dem_8m',
]);

/** Location for the output files to be stored */
const OutputPath = '/tmp/mapsheet-coverage/';

/**
 * Number of decimal places to restrict capture areas too
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
  },
  async handler(args) {
    const startTime = performance.now();
    registerCli(this, args);
    logger.info('MapSheet:Start');

    if (!ValidCodes.has(args.epsgCode)) {
      logger.error({ epsgCode: args.epsgCode }, 'Invalid:EpsgCode');
      return;
    }

    const config = await fsa.readJson<ConfigTileSetRaster>(args.location);

    /** All the layer's capture areas areas with some additonal metadata */
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
        existing.push(url.href.replace('.json', '.tiff'));
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

    // List of files to be created
    const todo = [...mapSheets].map((m) => {
      return { output: `${m[0]}.tiff`, input: m[1].reverse(), includeDerived: true };
    });

    await fsa.write(fsa.join(OutputPath, 'file-list.json'), JSON.stringify(todo));
    logger.info(
      {
        duration: performance.now() - startTime,
        layersFound: allLayers.features.length,
        layersNeeded: layersRequired.features.length,
      },
      'MapSheetCoverage:Done',
    );
  },
});
