import { ConfigBundled, ConfigImagery, ConfigProviderMemory, ConfigTileSet } from '@basemaps/config';
import { Bounds, EpsgCode } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { command, option, optional, string } from 'cmd-ts';
import * as fgb from 'flatgeobuf/lib/mjs/geojson.js';
import type { FeatureCollection, MultiPolygon } from 'geojson';
import { promisify } from 'util';
import { gunzip } from 'zlib';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { registerCli, verbose } from '../common.ts';

const gunzipProm = promisify(gunzip);

export function isGzip(b: Buffer): boolean {
  return b[0] === 0x1f && b[1] === 0x8b;
}

/**
 * Read a basemaps config file as JSON
 *
 * If the file ends with .gz or is a GZIP like {@link isGzip} file it will automatically be decompressed.
 */
async function readConfig(config: string): Promise<ConfigBundled> {
  const obj = await fsa.read(config);
  if (config.endsWith('.gz') || isGzip(obj)) {
    const data = await gunzipProm(obj);
    return JSON.parse(data.toString()) as ConfigBundled;
  }
  return JSON.parse(obj.toString()) as ConfigBundled;
}

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
  bmConfig: option({
    type: string,
    long: 'bm-config',
    description: 'Path of basemaps config json, this can be both a local path or s3 location',
  }),
  output: option({
    type: string,
    long: 'output',
    description: 'Output of the map sheet file',
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
  description: 'Create a cog map sheet from provided flatgeobuf',
  args: CommandCreateMapSheetArgs,
  async handler(args) {
    registerCli(this, args);
    const path = args.path;
    const config = args.bmConfig;
    const outputPath = args.output;

    const include = args.include ? new RegExp(args.include.toLowerCase(), 'i') : undefined;
    const exclude = args.exclude ? new RegExp(args.exclude.toLowerCase(), 'i') : undefined;

    logger.info({ path }, 'MapSheet:LoadFgb');
    const buf = await fsa.read(path);
    logger.info({ config }, 'MapSheet:LoadConfig');
    const configJson = await readConfig(config);
    const mem = ConfigProviderMemory.fromJson(configJson);

    const rest = fgb.deserialize(buf) as FeatureCollection;
    const featuresWritePromise = fsa.write('features.json', JSON.stringify(rest));

    const aerial = await mem.TileSet.get('ts_aerial');
    if (aerial == null) throw new Error('Invalid config file.');

    logger.info({ path, config }, 'MapSheet:CreateMapSheet');
    const outputs = await createMapSheet(aerial, mem, rest, include, exclude);

    logger.info({ outputPath }, 'MapSheet:WriteOutput');
    const outputWritePromise = fsa.write(outputPath, JSON.stringify(outputs, null, 2));

    await Promise.all([featuresWritePromise, outputWritePromise]);
  },
});

export async function createMapSheet(
  aerial: ConfigTileSet,
  mem: ConfigProviderMemory,
  rest: FeatureCollection,
  include: RegExp | undefined,
  exclude: RegExp | undefined,
): Promise<Output[]> {
  // Find all the valid NZTM imagery from the config
  const imagery: ConfigImagery[] = [];
  for (const layer of aerial.layers) {
    const nztmImageryId = layer[EpsgCode.Nztm2000];
    if (nztmImageryId == null) continue;

    if (layer.minZoom != null && layer.minZoom >= 32) continue;
    if (layer.maxZoom != null && layer.maxZoom <= 19) continue;

    if (exclude && exclude.test(layer.name)) continue;
    if (include && !include.test(layer.name)) continue;

    const img = mem.objects.get(nztmImageryId) as ConfigImagery;
    if (img == null) continue;
    imagery.push(img);
  }

  // Do bounds check and add current files
  const outputs: Output[] = [];
  for (const feature of rest.features) {
    if (feature.properties == null) continue;
    const sheetCode = feature.properties['sheet_code_id'] as string;
    const current: Output = { sheetCode, files: [] };
    outputs.push(current);
    const bounds = Bounds.fromMultiPolygon((feature.geometry as MultiPolygon).coordinates);

    for (const img of imagery) {
      if (img.bounds == null || Bounds.fromJson(img.bounds).intersects(bounds)) {
        for (const file of img.files) {
          if (bounds.intersects(Bounds.fromJson(file))) {
            current.files.push(fsa.join(img.uri, getTiffName(file.name)));
          }
        }
      }
    }
  }

  return outputs;
}

export function getTiffName(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')) return name;
  return `${name}.tiff`;
}
