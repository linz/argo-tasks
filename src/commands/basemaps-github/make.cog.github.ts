import {
  ConfigId,
  ConfigLayer,
  ConfigPrefix,
  ConfigTileSet,
  ConfigTileSetRaster,
  ConfigTileSetVector,
  TileSetType,
} from '@basemaps/config';
import { TileSetConfigSchema } from '@basemaps/config/build/json/parse.tile.set.js';
import { fsa, LogType } from '@basemaps/shared';
import prettier from 'prettier';

import { createPR, GithubApi } from './github.js';

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
  individual?: boolean;
}

export const DefaultCategorySetting: Record<Category, CategorySetting> = {
  [Category.Urban]: { minZoom: 14, individual: false },
  [Category.Rural]: { minZoom: 13, individual: false },
  [Category.Satellite]: { minZoom: 5, individual: false },
  [Category.Event]: { individual: true },
  [Category.Scanned]: { minZoom: 0, maxZoom: 32 },
  [Category.Other]: { individual: true },
};

export function parseCategory(category: string): Category {
  const c = category.toLocaleLowerCase();
  if (c.includes('urban')) return Category.Urban;
  else if (c.includes('rural')) return Category.Rural;
  else if (c.includes('satellite')) return Category.Satellite;
  else return Category.Other;
}

export const DefaultPrettierFormat: prettier.Options = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  useTabs: false,
  tabWidth: 2,
};

const ConfigPrettierFormat = Object.assign({}, DefaultPrettierFormat, { printWidth: 200 });

async function formatConfigFile(tileSet: ConfigTileSet | TileSetConfigSchema): Promise<string> {
  const formatted = prettier.format(JSON.stringify(tileSet), { ...ConfigPrettierFormat, parser: 'json' });
  return formatted;
}

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
    individual: boolean,
    logger: LogType,
  ): Promise<void> {
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-raster-${this.imagery}`;
    const title = `config(raster): Add imagery ${this.imagery} to ${filename} config file.`;

    // Clone the basemaps-config repo and checkout branch
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    if (individual) {
      // Prepare new standalone tileset config
      layer.category = category;
      layer.minZoom = 0;
      layer.maxZoom = 32;
      const tileSet: TileSetConfigSchema = {
        type: TileSetType.Raster,
        id: ConfigId.prefix(ConfigPrefix.TileSet, layer.name),
        title: layer.title,
        background: '#00000000',
        category,
        layers: [layer],
      };
      const content = await formatConfigFile(tileSet);
      const tileSetPath = fsa.joinAll('config', 'tileset', 'individual', `${layer.name}.json`);
      const file = { path: tileSetPath, content };
      // Github create pull request
      await createPR(gh, branch, title, [file], logger);
    } else {
      // Prepare new aerial tileset config
      const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
      const tileSetContent = await gh.getContent(tileSetPath, logger);
      const tileSet = JSON.parse(tileSetContent) as ConfigTileSetRaster;
      const newTileSet = await this.prepareRasterTileSetConfig(layer, tileSet, category);
      // skip pull request if not an urban or rural imagery
      if (newTileSet == null) return;
      // Github
      const content = await formatConfigFile(newTileSet);
      const file = { path: tileSetPath, content };
      // Github create pull request
      await createPR(gh, branch, title, [file], logger);
    }
  }

  /**
   * Set the default setting for the category
   */
  setDefaultConfig(layer: ConfigLayer, category: Category): ConfigLayer {
    layer.category = category;
    const defaultSetting = DefaultCategorySetting[category];
    if (defaultSetting.minZoom != null && layer.minZoom != null) layer.minZoom = defaultSetting.minZoom;
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
   * Prepare and create pull request for the aerial tileset config
   */
  async updateVectorTileSet(filename: string, layer: ConfigLayer, logger: LogType): Promise<void> {
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-vector-${this.imagery}`;

    // Prepare new aerial tileset config
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
    const tileSetContent = await gh.getContent(tileSetPath, logger);
    const tileSet = JSON.parse(tileSetContent) as ConfigTileSetVector;
    const newTileSet = await this.prepareVectorTileSetConfig(layer, tileSet);

    // skip pull request if not an urban or rural imagery
    if (newTileSet == null) return;
    // Github
    const title = `config(vector): Update the ${this.imagery} to ${filename} config file.`;
    const content = await formatConfigFile(newTileSet);
    const file = { path: tileSetPath, content };
    // Github create pull request
    await createPR(gh, branch, title, [file], logger);
  }

  /**
   * Prepare raster tileSet config json
   */
  async prepareVectorTileSetConfig(layer: ConfigLayer, tileSet: ConfigTileSetVector): Promise<ConfigTileSetVector> {
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