import { ConfigTileSetVector } from '@basemaps/config';
import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import path from 'path';
import { StacCollection } from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { GithubApi } from '../../utils/github.js';
import { registerCli, verbose } from '../common.js';

interface LdsLayer {
  /** Path of file eg `s3://linz-lds-cache/50306/foo.gpkg` or `./.cache/50306/foo.gpkg` */
  filePath: string;
  /** Layer Id */
  layerId: number;
  /** LDS Version Id */
  version: number;
}

function getLastestFile(files: string[]): Map<number, LdsLayer> {
  const ldsLayers = new Map<number, LdsLayer>(); // lds: layerId->version
  for (const file of files) {
    if (!file.endsWith('gpkg')) continue;
    // Parse the layerId and version from filename, like s3://linz-lds-cache/50063/50063_304191.gpkg
    const filename = path.parse(file).base;
    const name = filename.replace('.gpkg', '');
    const [layerIdStr, versionStr] = name.split('_');
    if (layerIdStr == null || versionStr == null) throw new Error(`Unable to parse lds layer from path ${file}`);
    const layerId = Number(layerIdStr);
    const version = Number(versionStr);
    if (isNaN(layerId)) throw new Error('Invalid LayerId:' + layerId);
    if (isNaN(version)) throw new Error('Invalid version:' + version);
    // Cache layer with the latest version
    const ldsLayer = {
      filePath: file,
      layerId,
      version,
    };
    const cachedLdsLayer = ldsLayers.get(layerId);
    if (cachedLdsLayer) {
      if (cachedLdsLayer.version < ldsLayer.version) ldsLayers.set(layerId, ldsLayer);
    } else {
      ldsLayers.set(layerId, ldsLayer);
    }
  }
  return ldsLayers;
}

export const CommandValidateUpdates = {
  verbose,
  filename: option({
    type: string,
    long: 'filename',
    description: 'Target ETL filename',
  }),
  output: option({
    type: string,
    long: 'output',
    description: 'Output location for the update ldsLayers',
  }),
  repository: option({
    type: string,
    long: 'repository',
    description: 'Github repository reference',
    defaultValue: () => 'linz/basemaps-config',
    defaultValueIsSerializable: true,
  }),
};

export const basemapsValidateUpdates = command({
  name: 'bm-etl-validate-updates',
  version: CliInfo.version,
  description: 'Validation for the Vector ETL to check for updates.',
  args: CommandValidateUpdates,
  async handler(args) {
    registerCli(this, args);
    const filename = args.filename;
    // Get the production tileset config from basemaps-config repo
    const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
    const gh = new GithubApi(args.repository);
    const tileSetContent = await gh.getContent(tileSetPath);
    if (tileSetContent == null) throw new Error(`Failed to get config ${filename} from config repo.`);
    // update the existing tileset
    let url;
    const tileSet = JSON.parse(tileSetContent) as ConfigTileSetVector;
    for (let i = 0; i < tileSet.layers.length; i++) {
      if (tileSet.layers[i]?.name === filename) {
        url = tileSet.layers[i]?.[3857];
      }
    }

    if (url == null) throw new Error(`Failed to find the production url from tileSet`);
    const collectionPath = url.replace(`${filename}.tar.co`, 'collection.json');
    const collection = await fsa.readJson<StacCollection>(collectionPath);
    if (collection == null) throw new Error(`Failed to get target collection json from ${collectionPath}.`);
    const existingLdsLayers = collection.links.filter((f) => f.rel === 'lds:layer');
    const latestLdsLayers = await fsa.toArray(fsa.list('s3://linz-lds-cache/')).then((f) => getLastestFile(f));

    const updates: LdsLayer[] = [];

    for (const layer of existingLdsLayers) {
      const layerId = layer['lds:id'] as number;
      const version = layer['lds:version'] as number;
      const latestLdsLayer = latestLdsLayers.get(layerId);
      if (latestLdsLayer == null) {
        throw new Error(`ETL required LDS layer ${layerId} does not been cached in lds cache`);
      }
      if (latestLdsLayer.version > version) updates.push(latestLdsLayer);
    }

    await fsa.write(args.output, JSON.stringify(updates, null, 2));
  },
});
