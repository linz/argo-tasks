import { fsa } from '@chunkd/fs';
import { command, option, restPositionals, string } from 'cmd-ts';
import * as stac from 'stac-ts';
import { createGunzip } from 'zlib';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';

function getTargetPath(source: string, path: string): string {
  if (path.startsWith('./')) return fsa.join(source, path.slice(2));
  throw new Error('No relative path found: ' + path);
}

export const commandLdsFetch = command({
  name: 'lds-fetch-layer',
  description: 'Download a LDS layer from the LDS Cache',
  args: {
    config,
    verbose,
    layers: restPositionals({ type: string, description: 'Layer id and optional version "layer@version"' }),
    target: option({ type: string, long: 'target', description: 'Target directory to save files' }),
  },
  handler: async (args) => {
    registerCli(args);

    for (const layer of args.layers) {
      const [layerId, layerVersion] = layer.split('@');

      if (isNaN(Number(layerId))) throw new Error('Invalid LayerId:' + layerId);
      logger.info({ layerId, layerVersion }, 'Collection:Download:Start');

      if (layerVersion != null) {
        if (isNaN(Number(layerVersion))) throw new Error('Invalid LayerVersion:' + layerVersion);
        const source = `s3://linz-lds-cache/${layerId}/${layerId}_${layerVersion}.gpkg`;
        await fsa.head(source); // Ensure we have read permission for the source

        logger.info({ layerId, layerVersion, source }, 'Collection:Item:Fetch');
        const fileName = `./${layerId}_${layerVersion}.gpkg`;
        const targetLocation = fsa.join(args.target, fileName);
        await fsa.write(targetLocation, fsa.stream(source).pipe(createGunzip()));
      }

      const collectionJson = await fsa.readJson<stac.StacCollection>(`s3://linz-lds-cache/${layerId}/collection.json`);
      logger.info({ layerId, title: collectionJson.title }, 'Collection:Download:Done');

      const lastItem = collectionJson.links.filter((f) => f.rel === 'item').pop();
      if (lastItem == null) throw new Error('No items found');

      const targetFile = fsa.join(args.target, lastItem.href.replace('.json', '.gpkg'));

      const targetPath = getTargetPath(`s3://linz-lds-cache/${layerId}/`, lastItem.href).replace('.json', '.gpkg');
      logger.info({ layerId, lastItem, source: targetPath }, 'Collection:Item:Fetch');
      await fsa.write(targetFile, fsa.stream(targetPath).pipe(createGunzip()));
    }
  },
});
