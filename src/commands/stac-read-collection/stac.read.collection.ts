import { fsa } from '@chunkd/fs';
import { command, option, optional } from 'cmd-ts';
import type { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import type { StacCollectionLinz } from '../../utils/metadata.ts';
import { config, registerCli, Url, UrlFolder, urlPathEndsWith, verbose } from '../common.ts';

export const commandStacReadCollection = command({
  name: 'stac-read-collection',
  description: 'Read a STAC collection. Outputs requested STAC fields.',
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
      defaultValue: () => fsa.toUrl('file:///tmp/stac-collection-fields/'),
    }),
  },

  async handler(args) {
    registerCli(this, args);
    const startTime = performance.now();

    logger.info('StacReadCollection:Start');

    if (args.odrUrl) {
      const collectionLocation = urlPathEndsWith(args.odrUrl, '/collection.json')
        ? args.odrUrl
        : new URL('collection.json', args.odrUrl);
      const collection = await fsa.readJson<StacCollection & StacCollectionLinz>(collectionLocation);
      if (collection == null)
        throw new Error(`Failed to get collection.json from ${protocolAwareString(collectionLocation)}.`);
      const itemLink = collection.links.find((f) => f.rel === 'item');
      if (itemLink) {
        const scaleResults = itemLink.href.match(/_(\d+)_/);
        const scale = scaleResults?.[1];
        if (scale) {
          await writeSetupFiles(scale, args.output);
          logger.info(
            { duration: performance.now() - startTime, args: { odrUrl: args.odrUrl, scale } },
            'StacReadCollection:Done',
          );
        }
      }
    }
  },
});

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
