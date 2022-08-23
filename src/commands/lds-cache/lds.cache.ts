import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import * as stac from 'stac-ts';
import { createGunzip } from 'zlib';
import { registerFileSystem } from '../../fs.register.js';
import { logger } from '../../log.js';
import { config } from '../common.js';

function getTargetPath(source: string, path: string): string {
  if (path.startsWith('./')) return fsa.join(source, path.slice(2));
  throw new Error('No relative path found: ' + path);
}

export const commandLdsFetch = command({
  name: 'lds-fetch-layer',
  args: {
    config,
    layerId: option({ type: string, long: 'layer-id', description: 'Layer to download' }),
    target: option({ type: string, long: 'target', description: 'Target location to save file' }),
  },
  handler: async (args) => {
    registerFileSystem(args.config);

    const layerId = args.layerId;
    if (isNaN(Number(layerId))) throw new Error('Invalid LayerId:' + layerId);
    logger.info({ layerId }, 'Collection:Download:Start');

    const collectionJson = await fsa.readJson<stac.StacCollection>(`s3://linz-lds-cache/${layerId}/collection.json`);
    logger.info({ layerId, title: collectionJson.title }, 'Collection:Download:Done');

    const lastItem = collectionJson.links.filter((f) => f.rel === 'item').pop();
    if (lastItem == null) throw new Error('No items found');

    const targetFile = args.target ?? lastItem.href.replace('.json', '.gpkg');

    const targetPath = getTargetPath(`s3://linz-lds-cache/${layerId}/`, lastItem.href).replace('.json', '.gpkg');
    logger.info({ layerId, lastItem, source: targetPath }, 'Collection:Item:Fetch');
    await fsa.write(targetFile, fsa.stream(targetPath).pipe(createGunzip()));
  },
});
