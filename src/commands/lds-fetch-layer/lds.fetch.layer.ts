import { fsa } from '@chunkd/fs';
import { command, option, restPositionals, string } from 'cmd-ts';
import type * as stac from 'stac-ts';
import { createGunzip } from 'zlib';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, Url, verbose } from '../common.ts';

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
        const targetLocation = new URL(fileName, args.target);
        await fsa.write(targetLocation, fsa.readStream(source).pipe(createGunzip()));
      }

      const collectionJsonUrl = new URL(`s3://linz-lds-cache/${layerId}/collection.json`);
      const collectionJson = await fsa.readJson<stac.StacCollection>(collectionJsonUrl);
      logger.info({ layerId, title: collectionJson.title }, 'Collection:Download:Done');
      const lastItem = collectionJson.links.filter((f) => f.rel === 'item').pop();
      if (lastItem == null) throw new Error('No items found');

      const targetFileGpkg = lastItem.href.replace('.json', '.gpkg');
      const targetFile = new URL(targetFileGpkg, args.target);
      const targetPath = new URL(targetFileGpkg, collectionJsonUrl);
      logger.info({ layerId, lastItem, source: targetPath }, 'Collection:Item:Fetch');
      await fsa.write(targetFile, fsa.readStream(targetPath).pipe(createGunzip()));
    }
  },
});
