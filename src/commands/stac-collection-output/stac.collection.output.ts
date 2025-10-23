import { fsa } from '@chunkd/fs';
import { command, option, optional } from 'cmd-ts';
import type { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import { type GridSize, GridSizes } from '../../utils/mapsheet.ts';
import type { StacCollectionLinz } from '../../utils/metadata.ts';
import { config, registerCli, Url, UrlFolder, urlPathEndsWith, verbose } from '../common.ts';

export const commandStacCollectionOutput = command({
  name: 'stac-collection-output',
  description: 'Read a STAC collection. Outputs implemented field(s): scale.',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    odrUrl: option({
      type: Url,
      long: 'odr-url',
      description: 'Open Data Registry URL of existing dataset',
    }),
    output: option({
      type: optional(UrlFolder),
      long: 'output',
      description: 'Where to store output files',
      defaultValueIsSerializable: true,
      defaultValue: () => fsa.toUrl('file:///tmp/stac-collection-output/'),
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();

    logger.info('StacCollectionOutput:Start');

    if (args.odrUrl) {
      const collectionLocation = urlPathEndsWith(args.odrUrl, '/collection.json')
        ? args.odrUrl
        : new URL('collection.json', args.odrUrl);
      const collection = await fsa.readJson<StacCollection & StacCollectionLinz>(collectionLocation);
      if (collection == null)
        throw new Error(`Failed to get collection.json from ${protocolAwareString(collectionLocation)}.`);
      const scale = getScale(collection, collectionLocation);
      await writeSetupFiles(scale, args.output);
      logger.info(
        { duration: performance.now() - startTime, args: { odrUrl: args.odrUrl, scale } },
        'StacCollectionOutput:Done',
      );
    }
  },
});

/**
 * Get the scale from a STAC Collection. 1:50K mapsheets are not covered by this function.
 *
 * @param collection STAC Collection
 * @param collectionLocation Location of the STAC Collection
 * @throws Will throw an error if the scale is not retrieved
 * @returns scale as a string
 */
export function getScale(collection: StacCollection & StacCollectionLinz, collectionLocation: URL): string {
  const itemLink = collection.links.find((f) => f.rel === 'item');
  if (!itemLink?.href) {
    throw new Error(`No valid item link href found in collection at ${protocolAwareString(collectionLocation)}.`);
  }
  const scaleResults = itemLink?.href.match(/_(\d+)_/);
  const scale = scaleResults?.[1];
  if (!scale) {
    throw new Error(`Failed to get scale from ${protocolAwareString(collectionLocation)}.`);
  }
  return scale;
}

/**
 * Check the Collection scale is a valid mapsheet scale
 *
 * @param scale the scale string from the STAC collection
 * @return true if scale is valid and a number, false otherwise
 */

export function isValidGridSize(scale: string): boolean {
  const gridSize = Number(scale);
  return !isNaN(gridSize) && GridSizes.includes(gridSize as GridSize);
}

/**
 * Write the implemented STAC collection fields to files for Argo to use
 *
 * @param scale the scale of the ODR dataset
 * @param output the output path for the setup files
 */
export async function writeSetupFiles(scale: string, output?: URL): Promise<void> {
  const scalePath = new URL('scale', output);
  await fsa.write(scalePath, scale);
}
