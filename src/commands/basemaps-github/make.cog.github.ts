import {
  ConfigLayer,
  ConfigTileSetRaster,
  ConfigTileSetVector,
  TileSetType,
} from '@basemaps/config/build/config/tile.set.js';
import { TileSetConfigSchema } from '@basemaps/config/build/json/parse.tile.set.js';
import { VectorFormat } from '@basemaps/geo';
import { fsa } from '@chunkd/fs';
import { StacCollection } from 'stac-ts';

import { logger } from '../../log.js';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.js';
import { GithubApi } from '../../utils/github.js';
import { prettyPrint } from '../format/pretty.print.js';

export enum Category {
  Urban = 'Urban Aerial Photos',
  Rural = 'Rural Aerial Photos',
  Satellite = 'Satellite Imagery',
  Event = 'Event',
  Scanned = 'Scanned Aerial Imagery',
  Other = 'New Aerial Photos',
}

export interface CategorySetting {
  minZoom?: number;
  maxZoom?: number;
}

export const DefaultCategorySetting: Record<Category, CategorySetting> = {
  [Category.Urban]: { minZoom: 14 },
  [Category.Rural]: { minZoom: 13 },
  [Category.Satellite]: { minZoom: 5 },
  [Category.Scanned]: { minZoom: 0, maxZoom: 32 },
  [Category.Other]: {},
  [Category.Event]: {},
};

const botEmail = 'basemaps@linz.govt.nz';
const ConfigPrettierFormat = Object.assign({}, DEFAULT_PRETTIER_FORMAT, { printWidth: 200 });

export class MakeCogGithub {
  imagery: string;
  repository: string;
  constructor(imagery: string, repository: string) {
    this.imagery = imagery;
    this.repository = repository;
  }

  /**
   * Prepare and create pull request for the aerial tileset config
   */
  async updateRasterTileSet(
    filename: string,
    layer: ConfigLayer,
    category: Category,
    region: string | undefined,
  ): Promise<void> {
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-raster-${this.imagery}`;
    const title = `config(raster): Add imagery ${this.imagery} to ${filename} config file.`;

    // Clone the basemaps-config repo and checkout branch
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    if (region) {
      // Prepare new standalone tileset config
      layer.category = category;
      layer.minZoom = 0;
      layer.maxZoom = 32;
      const tileSet: TileSetConfigSchema = {
        type: TileSetType.Raster,
        id: `ts_${layer.name}`,
        title: layer.title,
        background: '#00000000',
        category,
        layers: [layer],
      };
      const content = await prettyPrint(JSON.stringify(tileSet, null, 2), ConfigPrettierFormat);
      const tileSetPath = fsa.joinAll('config', 'tileset', region, `${layer.name}.json`);
      const file = { path: tileSetPath, content };
      // Github create pull request
      await gh.createPullRequest(branch, title, botEmail, [file]);
    } else {
      // Prepare new aerial tileset config
      const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
      const tileSetContent = await gh.getContent(tileSetPath);
      if (tileSetContent == null) throw new Error(`Unable get the ${filename}.json from config repo.`);
      const tileSet = JSON.parse(tileSetContent) as ConfigTileSetRaster;
      const newTileSet = await this.prepareRasterTileSetConfig(layer, tileSet, category);
      // skip pull request if not an urban or rural imagery
      if (newTileSet == null) return;
      // Github
      const content = await prettyPrint(JSON.stringify(newTileSet, null, 2), ConfigPrettierFormat);
      const file = { path: tileSetPath, content };
      // Github create pull request
      await gh.createPullRequest(branch, title, botEmail, [file]);
    }
  }

  /**
   * Set the default setting for the category
   */
  setDefaultConfig(layer: ConfigLayer, category: Category): ConfigLayer {
    layer.category = category;
    const defaultSetting = DefaultCategorySetting[category];
    if (defaultSetting.minZoom != null && layer.minZoom == null) layer.minZoom = defaultSetting.minZoom;
    return layer;
  }

  /**
   * Add new layer at the bottom of related category
   */
  addLayer(layer: ConfigLayer, tileSet: ConfigTileSetRaster, category: Category): ConfigTileSetRaster {
    for (let i = tileSet.layers.length - 1; i >= 0; i--) {
      // Add new layer at the end of category
      if (tileSet.layers[i]?.category === category) {
        // Find first valid category and insert new record above that.
        tileSet.layers.splice(i + 1, 0, layer);
        break;
      }
    }
    return tileSet;
  }

  /**
   * Prepare raster tileSet config json
   */
  async prepareRasterTileSetConfig(
    layer: ConfigLayer,
    tileSet: ConfigTileSetRaster,
    category: Category,
  ): Promise<ConfigTileSetRaster | undefined> {
    // Reprocess existing layer
    for (let i = 0; i < tileSet.layers.length; i++) {
      if (tileSet.layers[i]?.name === layer.name) {
        tileSet.layers[i] = layer;
        return tileSet;
      }
    }

    // Set default Config if not existing layer
    this.setDefaultConfig(layer, category);

    // Set layer zoom level and add to latest order
    if (category === Category.Rural) {
      for (let i = 0; i < tileSet.layers.length; i++) {
        // Add new layer above the first Urban
        if (tileSet.layers[i]?.category === Category.Urban) {
          // Find first valid Urban and insert new record above that.
          tileSet.layers.splice(i, 0, layer);
          break;
        }
      }
    } else if (category === Category.Other) {
      // Add new layer at the bottom
      tileSet.layers.push(layer);
    } else {
      this.addLayer(layer, tileSet, category);
    }

    return tileSet;
  }

  /**
   * Get the collection.json url from vector target
   *
   * s3://linz-basemaps-staging/vector/3857/topographic/01HSF04SG9M1P3V667A4NZ1MN8/topographic.tar.co
   * ->
   * s3://linz-basemaps-staging/vector/3857/topographic/01HSF04SG9M1P3V667A4NZ1MN8/collection.json
   */
  getCollectionUrl(target: string): string {
    const path = target.substring(0, target.lastIndexOf('/'));
    return fsa.join(path, 'collection.json');
  }

  /**
   * Prepare and create pull request for the aerial tileset config
   */
  async diffVectorUpdate(layer: ConfigLayer, existingTileSet?: ConfigTileSetVector): Promise<string> {
    let md = '';
    // Vector layer only support for 3857
    if (layer[3857] == null) return md;
    const newCollectionPath = this.getCollectionUrl(layer[3857]);
    const newCollection = await fsa.readJson<StacCollection>(newCollectionPath);
    if (newCollection == null) throw new Error(`Failed to get target collection json from ${newCollectionPath}.`);
    const ldsLayers = newCollection.links.filter((f) => f.rel === 'lds:layer');

    // Log all the new inserts for new tileset
    if (existingTileSet == null) {
      md += `New TileSet ts_${layer.name} with layer ${layer.name}.\n`;
      for (const l of ldsLayers) {
        md += `🟩 ${l['lds:name']} - version: ${l['lds:version']} features: ${l['lds:feature_count']}`;
      }
      return md;
    }

    // Compare the different of existing tileset
    for (const l of existingTileSet.layers) {
      if (l[3857] == null) continue;
      if (l.name !== layer.name) continue;
      md += `Update for TileSet ${existingTileSet.id} layer ${layer.name}.\n`;
      const existingCollectionPath = this.getCollectionUrl(l[3857]);
      const existingCollection = await fsa.readJson<StacCollection>(existingCollectionPath);
      if (existingCollection == null) {
        throw new Error(`Failed to get target collection json from ${existingCollectionPath}.`);
      }
      const existingLdsLayers = existingCollection.links.filter((f) => f.rel === 'lds:layer');
      for (const l of ldsLayers) {
        const existingLayer = existingLdsLayers.find((f) => f['lds:id'] === l['lds:id']);
        if (existingLayer == null) {
          // New Layer Added
          md += `🟩 ${l['lds:name']} - version: ${l['lds:version']} features: ${l['lds:feature_count']}`;
        } else {
          if (existingLayer['lds:version'] !== l['lds:version']) {
            // Layer Updated
            const featureChange = Number(l['lds:feature_count']) - Number(l['lds:feature_count']);
            if (featureChange >= 0) {
              // Add Features
              md += `🟦 ${l['lds:name']} - version: ${l['lds:version']} (from: ${existingLayer['lds:version']}) features: ${l['lds:feature_count']} (+${featureChange})`;
            } else {
              // Remove Features
              md += `🟧 ${l['lds:name']} - version: ${l['lds:version']} (from: ${existingLayer['lds:version']}) features: ${l['lds:feature_count']} (-${featureChange})`;
            }
          }
        }
      }

      // Find removed layers
      const newIds = new Set(ldsLayers.map((l) => l['lds:id']));
      for (const l of existingLdsLayers) {
        if (newIds.has(l['lds:id'])) continue;
        // Removed Layer
        md += `🟥 ${l['lds:name']} features: -${l['lds:feature_count']}`;
      }
    }

    console.log(md);
    return md;
  }

  /**
   * Prepare and create pull request for the aerial tileset config
   */
  async updateVectorTileSet(filename: string, layer: ConfigLayer): Promise<void> {
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-vector-${this.imagery}`;

    // Prepare new aerial tileset config
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
    const tileSetContent = await gh.getContent(tileSetPath);

    // update the existing tileset
    const existingTileSet = tileSetContent != null ? (JSON.parse(tileSetContent) as ConfigTileSetVector) : undefined;
    const newTileSet = await this.prepareVectorTileSetConfig(layer, existingTileSet);

    const diff = await this.diffVectorUpdate(layer, existingTileSet);

    // skip pull request tileset prepare failure.
    if (newTileSet == null) return;
    // Github
    const title = `config(vector): Update the ${this.imagery} to ${filename} config file.`;
    const content = await prettyPrint(JSON.stringify(newTileSet, null, 2), ConfigPrettierFormat);
    const file = { path: tileSetPath, content };
    // Github create pull request
    await gh.createPullRequest(branch, title, botEmail, [file], diff);
  }

  /**
   * Prepare raster tileSet config json
   */
  async prepareVectorTileSetConfig(layer: ConfigLayer, tileSet?: ConfigTileSetVector): Promise<ConfigTileSetVector> {
    if (tileSet == null) {
      return {
        type: TileSetType.Vector,
        id: `ts_${layer.name}`,
        name: layer.name,
        title: layer.title,
        maxZoom: 15,
        format: VectorFormat.MapboxVectorTiles,
        layers: [layer],
      };
    }

    // Reprocess existing layer
    for (let i = 0; i < tileSet.layers.length; i++) {
      if (tileSet.layers[i]?.name === layer.name) {
        tileSet.layers[i] = layer;
        return tileSet;
      }
    }
    return tileSet;
  }
}
