import { DefaultColorRampOutput, DefaultTerrainRgbOutput, standardizeLayerName } from '@basemaps/config';
import type {
  ConfigLayer,
  ConfigTileSet,
  ConfigTileSetRaster,
  ConfigTileSetVector,
} from '@basemaps/config/build/config/tile.set.js';
import { TileSetType } from '@basemaps/config/build/config/tile.set.js';
import { fsa } from '@chunkd/fs';

import { logger } from '../../log.ts';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.ts';
import { GithubApi } from '../../utils/github.ts';
import { prettyPrint } from '../pretty-print/pretty.print.ts';

export const Categories = [
  'Urban Aerial Photos',
  'Rural Aerial Photos',
  'Satellite Imagery',
  'Elevation',
  'Event',
  'Scanned Aerial Imagery',
  'New Aerial Photos',
] as const;

export type Category = (typeof Categories)[number];

export interface CategorySetting {
  minZoom?: number;
  maxZoom?: number;
}

export const DefaultCategorySetting: Record<Category, CategorySetting> = {
  'Urban Aerial Photos': { minZoom: 14 },
  'Rural Aerial Photos': { minZoom: 13 },
  'Satellite Imagery': { minZoom: 5 },
  Elevation: { minZoom: 9 },
  'Scanned Aerial Imagery': { minZoom: 0, maxZoom: 32 },
  'New Aerial Photos': {},
  Event: {},
};

const botEmail = 'basemaps@linz.govt.nz';
const ConfigPrettierFormat = Object.assign({}, DEFAULT_PRETTIER_FORMAT, { printWidth: 200 });

export class MakeCogGithub {
  imagery: string;
  repository: string;
  /**
   * Reference Jira ticket
   *
   * @example "AIP-66"
   */
  ticket?: string;

  constructor(imagery: string, repository: string, ticket?: string) {
    this.imagery = imagery;
    this.repository = repository;
    this.ticket = ticket;
  }

  /**
   * Create a branch suffix in the format `-AIP-66`
   * if a reference ticket is supplied
   */
  get ticketBranchSuffix(): string {
    if (this.ticket) return `-${this.ticket}`;
    return '';
  }

  /**
   * Create a branch suffix in the format ` AIP-66`
   * if a reference ticket is supplied
   */
  get ticketCommitSuffix(): string {
    if (this.ticket) return ` ${this.ticket}`;
    return '';
  }

  /**
   * Prepare and create pull request for the aerial tileset config
   */
  async updateRasterTileSet(
    layer: ConfigLayer,
    category: Category,
    individual: boolean,
    region: string | undefined,
  ): Promise<void> {
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-raster-${this.imagery}${this.ticketBranchSuffix}`;
    const title = `config(raster): Add imagery ${this.imagery} to ${layer.name} ${this.ticketCommitSuffix}`;

    // Clone the basemaps-config repo and checkout branch
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    if (individual) {
      if (region == null) region = 'individual';
      // Prepare new standalone tileset config
      const targetLayer = { ...layer, category, minZoom: 0, maxZoom: 32 };
      const tileSet: ConfigTileSetRaster = {
        type: TileSetType.Raster,
        id: `ts_${layer.name}`,
        name: layer.name,
        title: layer.title,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        category,
        layers: [targetLayer],
      };
      const tileSetPath = fsa.joinAll('config', 'tileset', region, 'imagery', `${layer.name}.json`);
      // Github create pull request
      await this.createTileSetPullRequest(gh, branch, title, tileSetPath, tileSet);
    } else {
      // Prepare new aerial tileset config
      const tileSetPath = fsa.joinAll('config', 'tileset', `aerial.json`);
      const tileSetContent = await gh.getContent(tileSetPath);
      if (tileSetContent == null) throw new Error(`Unable get the aerial.json from config repo.`);
      const tileSet = JSON.parse(tileSetContent) as ConfigTileSetRaster;
      const newTileSet = await this.prepareRasterTileSetConfig(layer, tileSet, category);
      // Github create pull request
      await this.createTileSetPullRequest(gh, branch, title, tileSetPath, newTileSet);
    }
  }

  /**
   * Prepare and create pull request for the elevation tileset config
   */
  async updateElevationTileSet(layer: ConfigLayer, individual: boolean, region: string | undefined): Promise<void> {
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-elevation-${this.imagery}${this.ticketBranchSuffix}`;
    const title = `config(elevation): Add elevation ${this.imagery} to ${layer.name} config file.`;

    let type;
    if (layer.name.includes('_dsm_')) {
      type = 'dsm';
    } else if (layer.name.includes('_dem_')) {
      type = 'dem';
    } else {
      throw new Error(`Invalid elevation type for ${layer.name}, must be dem or dsm.`);
    }

    // Clone the basemaps-config repo and checkout branch
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    if (individual) {
      if (region == null) region = 'individual';
      const tileSet = await this.prepareElevationTileSetConfig(layer);
      const tileSetPath = fsa.joinAll('config', 'tileset', region, 'elevation', type, `${layer.name}.json`);
      // Github create pull request
      await this.createTileSetPullRequest(gh, branch, title, tileSetPath, tileSet);
    } else {
      // Prepare new elevation tileset config
      const tileSetPath = fsa.joinAll('config', 'tileset', type === 'dem' ? 'elevation.json' : 'elevation.dsm.json');
      const tileSetContent = await gh.getContent(tileSetPath);
      if (tileSetContent == null) throw new Error(`Failed to get config elevation from config repo.`);
      const tileSet = JSON.parse(tileSetContent) as ConfigTileSetRaster;
      const newTileSet = await this.prepareElevationTileSetConfig(layer, tileSet);
      // Github create pull request
      await this.createTileSetPullRequest(gh, branch, title, tileSetPath, newTileSet);
    }
  }

  /**
   * Prepare and create pull request for the aerial tileset config
   */
  async updateVectorTileSet(layer: ConfigLayer, individual: boolean): Promise<void> {
    const filename = layer.name;
    const gh = new GithubApi(this.repository);
    const branch = `feat/bot-config-vector-${this.imagery}${this.ticketBranchSuffix}`;
    const title = `config(vector): Update the ${this.imagery} to ${filename} config file.`;

    // Prepare new vector tileset config
    logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    if (individual) {
      const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
      const newTileSet = await this.prepareVectorTileSetConfig(layer, undefined);
      // Github create pull request
      await this.createTileSetPullRequest(gh, branch, title, tileSetPath, newTileSet);
    } else {
      const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
      const tileSetContent = await gh.getContent(tileSetPath);
      if (tileSetContent == null) throw new Error(`Failed to get config topographic from config repo.`);
      // update the existing tileset
      const existingTileSet = JSON.parse(tileSetContent) as ConfigTileSetVector;
      const newTileSet = await this.prepareVectorTileSetConfig(layer, existingTileSet);
      // Github create pull request
      await this.createTileSetPullRequest(gh, branch, title, tileSetPath, newTileSet);
    }
  }

  /**
   * Create pull request for a tileset config
   */
  async createTileSetPullRequest(
    gh: GithubApi,
    branch: string,
    title: string,
    tileSetPath: string,
    newTileSet: ConfigTileSet | undefined,
  ): Promise<void> {
    // skip pull request tileset prepare failure.
    if (newTileSet == null) throw new Error(`Failed to prepare new tileSet for ${tileSetPath}.`);

    // Github
    const content = await prettyPrint(JSON.stringify(newTileSet, null, 2), ConfigPrettierFormat);
    const file = { path: tileSetPath, content };
    // Github create pull request
    await gh.createPullRequest(branch, title, botEmail, [file]);
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
  ): Promise<ConfigTileSetRaster> {
    // Reprocess existing layer
    for (let i = 0; i < tileSet.layers.length; i++) {
      const existing = tileSet.layers[i];
      if (existing?.name === layer.name) {
        tileSet.layers[i] = { ...existing, ...layer };
        return tileSet;
      }
    }

    // Set default Config if not existing layer
    this.setDefaultConfig(layer, category);

    // Set layer zoom level and add to latest order
    if (category === 'Rural Aerial Photos') {
      for (let i = 0; i < tileSet.layers.length; i++) {
        // Add new layer above the first Urban
        if (tileSet.layers[i]?.category === 'Urban Aerial Photos') {
          // Find first valid Urban and insert new record above that.
          tileSet.layers.splice(i, 0, layer);
          break;
        }
      }
    } else if (category === 'New Aerial Photos') {
      // Add new layer at the bottom
      tileSet.layers.push(layer);
    } else {
      this.addLayer(layer, tileSet, category);
    }

    return tileSet;
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
        format: 'pbf',
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

  /**
   * Prepare raster tileSet config json
   */
  async prepareElevationTileSetConfig(layer: ConfigLayer, tileSet?: ConfigTileSetRaster): Promise<ConfigTileSetRaster> {
    if (tileSet == null) {
      // Prepare individual elevation tileset config
      const targetLayer: ConfigLayer = { ...layer, category: 'Elevation', minZoom: 0, maxZoom: 32 };
      return {
        type: TileSetType.Raster,
        id: `ts_${layer.name}`,
        name: layer.name,
        title: layer.title,
        category: 'Elevation',
        layers: [targetLayer],
        outputs: [DefaultTerrainRgbOutput, DefaultColorRampOutput],
      } as ConfigTileSetRaster;
    }

    this.setDefaultConfig(layer, 'Elevation');
    // Remove elevation layer.category if already exists
    if (layer.category) delete layer.category;

    // Prepare elevation tileset config
    for (let i = 0; i < tileSet.layers.length; i++) {
      const name = tileSet.layers[i]?.name;
      if (name != null && standardizeLayerName(name) === standardizeLayerName(layer.name)) {
        tileSet.layers[i] = layer;
        return tileSet;
      }
    }
    tileSet.layers.push(layer);
    return tileSet;
  }
}
