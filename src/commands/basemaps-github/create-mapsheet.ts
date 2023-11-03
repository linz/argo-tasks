import { ConfigBundled, ConfigProviderMemory } from '@basemaps/config';
import { Bounds, EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { command, option, optional, string } from 'cmd-ts';
import * as fgb from 'flatgeobuf/lib/mjs/geojson.js';
import { FeatureCollection, MultiPolygon } from 'geojson';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { registerCli, verbose } from '../common.js';

interface Output {
  sheetCode: string;
  files: string[];
}

export const CommandCreateMapSheetArgs = {
  verbose,
  path: option({
    type: string,
    long: 'path',
    description: 'Path of flatgeobuf, this can be both a local path or s3 location',
  }),
  config: option({
    type: string,
    long: 'config',
    description: 'Path of basemaps config json, this can be both a local path or s3 location',
  }),
  output: option({
    type: string,
    long: 'output',
    description: 'Output of the mapsheet file',
  }),
  include: option({
    type: optional(string),
    long: 'include',
    description: 'Include the layers with the pattern in the layer name.',
  }),
  exclude: option({
    type: optional(string),
    long: 'exclude',
    description: 'Exclude the layers with the pattern in the layer name.',
  }),
};

export const basemapsCreateMapSheet = command({
  name: 'bm-create-mapsheet',
  version: CliInfo.version,
  description: 'Create a cog mapsheet from provided flatgeobuf',
  args: CommandCreateMapSheetArgs,
  async handler(args) {
    registerCli(this, args);
    const path = args.path;
    const config = args.config;
    const outputPath = args.output;

    const include = args.include ? new RegExp(args.include.toLowerCase(), 'i') : undefined;
    const exclude = args.exclude ? new RegExp(args.exclude.toLowerCase(), 'i') : undefined;

    logger.info({ path }, 'MapSheet:LoadFgb');
    const buf = await fsa.read(path);
    logger.info({ config }, 'MapSheet:LoadConfig');
    const configJson = await fsa.readJson<ConfigBundled>(config);
    const mem = ConfigProviderMemory.fromJson(configJson);

    const rest = fgb.deserialize(buf) as FeatureCollection;

    const aerial = await mem.TileSet.get('ts_aerial');
    if (aerial == null) throw new Error('Invalid config file.');
    const layers = aerial.layers.filter(
      (c) =>
        c[EpsgCode.Nztm2000] != null && (c.maxZoom == null || c.maxZoom > 19) && (c.minZoom == null || c.minZoom < 32),
    );
    const imageryIds = new Set<string>();
    for (const layer of layers) {
      if (exclude && exclude.test(layer.name)) continue;
      if (include && !include.test(layer.name)) continue;
      if (layer[EpsgCode.Nztm2000] != null) imageryIds.add(layer[EpsgCode.Nztm2000]);
    }
    const imagery = await mem.Imagery.getAll(imageryIds);

    const outputs: Output[] = [];
    logger.info({ path, config }, 'MapSheet:CreateMapSheet');
    for (const feature of rest.features) {
      if (feature.properties == null) continue;
      const sheetCode = feature.properties['sheet_code_id'];
      const current: Output = { sheetCode, files: [] };
      outputs.push(current);
      const bounds = Bounds.fromMultiPolygon((feature.geometry as MultiPolygon).coordinates);

      for (const layer of layers) {
        if (layer[EpsgCode.Nztm2000] == null) continue;
        const img = imagery.get(layer[EpsgCode.Nztm2000]);
        if (img == null) continue;
        if (img.bounds == null || Bounds.fromJson(img.bounds).intersects(bounds)) {
          for (const file of img.files) {
            if (bounds.intersects(Bounds.fromJson(file))) {
              current.files.push(`${img.uri}/${file.name}.tiff`);
            }
          }
        }
      }
    }
    logger.info({ outputPath }, 'MapSheet:WriteOutput');
    fsa.write(outputPath, JSON.stringify(outputs, null, 2));
  },
});
