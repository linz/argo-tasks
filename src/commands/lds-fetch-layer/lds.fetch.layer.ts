import { fsa } from '@chunkd/fs';
import { command, option, restPositionals, string } from 'cmd-ts';
import type * as stac from 'stac-ts';
import { createGunzip } from 'zlib';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, Url, verbose } from '../common.ts';

// function getTargetPath(source: string, path: string): string {
//   if (path.startsWith('./')) return new URL(path.slice(2), source).href;
//   throw new Error('No relative path found: ' + path);
// }

export const commandLdsFetch = command({
  name: 'lds-fetch-layer',
  version: CliInfo.version,
  description: 'Download a LDS layer from the LDS Cache',
  args: {
    config,
    verbose,
    layers: restPositionals({ type: string, description: 'Layer id and optional version "layer@version"' }),
    target: option({ type: Url, long: 'target', description: 'Target directory to save files' }),
  },
  async handler(args) {
    registerCli(this, args);

    for (const layer of args.layers) {
      const [layerId, layerVersion] = layer.split('@');

      if (isNaN(Number(layerId))) throw new Error('Invalid LayerId:' + layerId);
      logger.info({ layerId, layerVersion }, 'Collection:Download:Start');

      if (layerVersion != null) {
        if (isNaN(Number(layerVersion))) throw new Error('Invalid LayerVersion:' + layerVersion);
        const source = new URL(`s3://linz-lds-cache/${layerId}/${layerId}_${layerVersion}.gpkg`);
        await fsa.head(source); // Ensure we have read permission for the source

        logger.info({ layerId, layerVersion, source }, 'Collection:Item:Fetch');
        const fileName = `./${layerId}_${layerVersion}.gpkg`;
        // const targetLocation = fsa.join(args.target, fileName);
        const targetLocation = new URL(fileName, args.target);
        await fsa.write(targetLocation, fsa.readStream(source).pipe(createGunzip()));
      }

      const collectionJsonUrl = new URL(`s3://linz-lds-cache/${layerId}/collection.json`);
      const collectionJson = await fsa.readJson<stac.StacCollection>(collectionJsonUrl);
      // const collectionJson = {
      //   links: [
      //     { rel: 'item', href: 'item1.json' },
      //     { rel: 'item', href: './item2.json' },
      //     { rel: 'item', href: 'https://somewhere/item3.json' },
      //   ],
      //   title: 'Example Collection',
      // }
      logger.info({ layerId, title: collectionJson.title }, 'Collection:Download:Done');
      const lastItem = collectionJson.links.filter((f) => f.rel === 'item').pop();
      if (lastItem == null) throw new Error('No items found');

      // const targetFile = fsa.join(args.target, );
      const targetFileGpkg = lastItem.href.replace('.json', '.gpkg'); // todo: better names?
      const targetFile = new URL(targetFileGpkg, args.target);
      // const targetFile = new URL(lastItem.href.replace('.json', '.gpkg'), args.target);
      const targetPath = new URL(targetFileGpkg, collectionJsonUrl);
      logger.info({ layerId, lastItem, source: targetPath }, 'Collection:Item:Fetch');
      await fsa.write(targetFile, fsa.readStream(targetPath).pipe(createGunzip()));
    }
  },
});

console.log('lds-fetch-layer command registered');
void commandLdsFetch.handler({
  config: undefined,
  verbose: false,
  layers: ['123@1'],
  target: new URL('file:///tmp/'),
});
