import {
  ConfigId,
  ConfigLayer,
  ConfigPrefix,
  ConfigTileSetRaster,
  ConfigTileSetVector,
  TileSetType,
} from '@basemaps/config';
import { LogType, fsa } from '@basemaps/shared';
import { Github } from './github.js';
import { TileSetConfigSchema } from '@basemaps/config/build/json/parse.tile.set.js';
import { execFileSync } from 'child_process';

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

export class MakeCogGithub {
  repo: string;
  repoName: string;
  logger: LogType;
  imagery: string;
  github: Github;
  _formatInstalled = false;

  constructor(imagery: string, repo: string, logger: LogType) {
    this.repo = repo;
    this.logger = logger;
    this.imagery = imagery;
    const [org, repoName] = repo.split('/');
    if (org == null || repoName == null) throw new Error(`Badly formatted repo name: ${repo}`);
    this.repoName = repoName;
    this.github = new Github(repo, org, repoName, logger);
  }

  /**
   * Install the dependencies for the cloned repo
   */
  npmInstall(): boolean {
    this.logger.info({ repository: this.repo }, 'GitHub: Npm Install');
    execFileSync('npm', ['install', '--include=dev'], { cwd: this.repoName });
    return true;
  }

  /**
   * Format the config files by prettier
   */
  formatConfigFile(path = './config/'): void {
    if (!this._formatInstalled) this._formatInstalled = this.npmInstall();
    this.logger.info({ repository: this.repo }, 'GitHub: Prettier');
    execFileSync('npx', ['prettier', '-w', path], { cwd: this.repoName });
  }

  /**
   * Prepare and create pull request for the aerial tileset config
   */
  async updateRasterTileSet(
    filename: string,
    layer: ConfigLayer,
    category: Category,
    individual: boolean,
  ): Promise<void> {
    const branch = `feat/bot-config-raster-${this.imagery}`;

    // Clone the basemaps-config repo and checkout branch
    this.github.clone();
    this.github.configUser();
    this.github.getBranch(branch);

    this.logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    if (individual) {
      // Prepare new standalone tileset config
      const tileSet: TileSetConfigSchema = {
        type: TileSetType.Raster,
        id: ConfigId.prefix(ConfigPrefix.TileSet, layer.name),
        title: layer.title,
        layers: [layer],
      };
      const tileSetPath = fsa.joinAll('config', 'tileset', 'individual', `${layer.name}.json`);
      const fullPath = fsa.join(this.repoName, tileSetPath);
      await fsa.write(fullPath, JSON.stringify(tileSet));
      // Format the config file by prettier
      this.formatConfigFile(tileSetPath);
      this.github.add([tileSetPath]);
    } else {
      // Prepare new aerial tileset config
      const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
      const fullPath = fsa.join(this.repoName, tileSetPath);
      const tileSet = await fsa.readJson<ConfigTileSetRaster>(fullPath);
      const newTileSet = await this.prepareRasterTileSetConfig(layer, tileSet, category);
      // skip pull request if not an urban or rural imagery
      if (newTileSet == null) return;
      await fsa.write(fullPath, JSON.stringify(newTileSet));
      // Format the config file by prettier
      this.formatConfigFile(tileSetPath);
      this.github.add([tileSetPath]);
    }

    // Commit and push the changes
    const message = `config(raster): Add imagery ${this.imagery} to ${filename} config file.`;
    this.github.commit(message);
    this.github.push();
    await this.github.createPullRequests(branch, message, false);
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
  async updateVectorTileSet(filename: string, layer: ConfigLayer): Promise<void> {
    const branch = `feat/bot-config-vector-${this.imagery}`;

    // Clone the basemaps-config repo and checkout branch
    this.github.clone();
    this.github.configUser();
    this.github.getBranch(branch);

    // Prepare new aerial tileset config
    this.logger.info({ imagery: this.imagery }, 'GitHub: Get the master TileSet config file');
    const tileSetPath = fsa.joinAll('config', 'tileset', `${filename}.json`);
    const fullPath = fsa.join(this.repoName, tileSetPath);
    const tileSet = await fsa.readJson<ConfigTileSetVector>(fullPath);
    const newTileSet = await this.prepareVectorTileSetConfig(layer, tileSet);

    // skip pull request if not an urban or rural imagery
    if (newTileSet == null) return;
    await fsa.write(fullPath, JSON.stringify(newTileSet));
    // Format the config file by prettier
    this.formatConfigFile(tileSetPath);

    // Commit and push the changes
    const message = `config(vector): Update the ${this.imagery} to ${filename} config file.`;
    this.github.add([tileSetPath]);
    this.github.commit(message);
    this.github.push();
    await this.github.createPullRequests(branch, message, false);
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
