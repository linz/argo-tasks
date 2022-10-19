import { fsa } from '@chunkd/fs';
import { CogTiff } from '@cogeotiff/core';
import { command, number, option, restPositionals, string } from 'cmd-ts';
import { basename } from 'path';
import { StacCollection, StacItem } from 'stac-ts';
import { ulid } from 'ulid';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { config, registerCli, verbose } from '../common.js';
import { Projection } from '@basemaps/shared/build/proj/projection.js';
import { Bounds, Nztm2000QuadTms, TileMatrixSets } from '@basemaps/geo';
import { logger } from '../../log.js';

export const commandStacTiff = command({
  name: 'stac-tiff',
  args: {
    config,
    verbose,
    concurrency: option({ type: number, long: 'concurrency', defaultValue: () => 50 }),
    location: restPositionals({ type: string, displayName: 'location', description: 'Manifest tiff files' }),
  },
  handler: async (args) => {
    registerCli(args);

    let collectionId: string | null = null;
    const queue = new ConcurrentQueue(args.concurrency);

    const abort = false;
    const items: StacItem[] = [];
    for (const location of args.location) {
      for await (const filePath of fsa.list(location)) {
        if (!filePath.endsWith('.json')) continue;
        if (filePath.endsWith('collection.json')) continue;
        queue.push(async () => {
          if (abort) return;
          // const
          const document: StacItem = await fsa.readJson(filePath);

          const newCollectionId = (document as any).collection;
          if (newCollectionId == null) throw new Error('Missing collectionId: ' + filePath);
          if (newCollectionId !== collectionId && collectionId != null)
            throw new Error('Different collectionId: ' + filePath);
          collectionId = newCollectionId;
          const item = await tiffToStac(filePath.replace('.json', '.tiff'), (document as any).collection);
          console.log(document, item);
          // const item = await tiffToStac(filePath, collectionId);
          // items.push(item);
          if (items.length % 100 === 0) {
            logger.info({ index: items.length }, 'Progress');
          }

          item.properties['start_datetime'] = document.properties['start_datetime'];
          item.properties['end_datetime'] = document.properties['end_datetime'];
          item.assets['visual']['file:checksum'] = document.assets['visual']['file:checksum'];

          await fsa.write(`./changes/${document.id}_after.json`, JSON.stringify(document, null, 2));
          await fsa.write(`./changes/${document.id}_before.json`, JSON.stringify(item, null, 2));
        });

        if (queue.taskCount > 0) break;
      }
      await queue.join();

      if (items.length === 0) {
        logger.warn({ location }, 'NoItems');
        return;
      }

      if (collectionId == null) throw new Error('Collection id missing');

      const collection = await tiffsToCollection(
        collectionId,
        'Manawatū-Whanganui 0.3m Urban Aerial Photos (2021-2022)',
        'Some description',
        items,
      );
      await fsa.write(fsa.join(location, 'catalog.json'), JSON.stringify(collection, null, 2));
      // for (const item of items) {
      // queue.push(() => fsa.write(fsa.join(location, item.id + '.json'), JSON.stringify(item, null, 2)));
      // }
      await queue.join();
    }

    logger.info({ count: items.length }, 'Stac:Created');
  },
});

async function tiffToStac(path: string, collectionId: string): Promise<StacItem> {
  const tiff = new CogTiff(fsa.source(path));
  await tiff.init(true);
  const fileName = basename(path);
  const id = fileName.replace('.tiff', '');
  const image = tiff.getImage(0);

  const bounds = Bounds.fromBbox(image.bbox);

  const tms = TileMatrixSets.find(`EPSG:${image.epsg}`);
  if (tms == null) throw new Error('Failed to find tile matrix');

  const { geometry } = Projection.get(tms).boundsToGeoJsonFeature(bounds) as any;
  return {
    stac_version: '1.0.0',
    stac_extensions: [
      'https://stac-extensions.github.io/file/v2.0.0/schema.json',
      'https://stac-extensions.github.io/projection/v1.0.0/schema.json',
    ],
    id: id,
    collection: collectionId,
    type: 'Feature',
    geometry,
    bbox: Projection.get(tms).boundsToWgs84BoundingBox(bounds),
    properties: {
      'proj:epsg': image.epsg,
      datetime: null,
      start_datetime: '2021-12-31T00:00:00Z',
      end_datetime: '2021-12-31T00:00:01Z',
    },
    links: [
      { rel: 'self', href: `./${id}.json`, type: 'application/json' },
      { rel: 'collection', href: './collection.json', type: 'application/json' },
      { rel: 'parent', href: './collection.json', type: 'application/json' },
    ],
    assets: {
      visual: {
        href: './' + fileName,
        type: 'image/tiff; application=geotiff; profile=cloud-optimized',
      },
    },
  };
}

async function tiffsToCollection(
  collectionId: string,
  title: string,
  description: string,
  items: StacItem[],
): Promise<StacCollection> {
  let bounds: Bounds | null = null;
  const itemLinks = [];
  for (const c of items) {
    if (c.bbox) {
      if (bounds == null) bounds = Bounds.fromBbox(c.bbox);
      else bounds = bounds.union(Bounds.fromBbox(c.bbox));
    }
    itemLinks.push({ rel: 'item', href: './' + c.id + '.json', type: 'application/json' });
  }

  if (bounds == null) throw new Error('No bounding box');
  const createdAt = new Date().toISOString();
  return {
    stac_version: '1.0.0',
    stac_extensions: [],
    type: 'Collection',
    license: 'CC-BY-4.0',
    id: collectionId,
    title: title,
    description: description,
    extent: {
      spatial: {
        bbox: [Projection.get(Nztm2000QuadTms).boundsToWgs84BoundingBox(bounds.toJson())],
      },
      temporal: { interval: [[createdAt, null]] },
    },
    links: [{ rel: 'self', href: './collection.json', type: 'application/json' }, ...itemLinks],
    providers: [
      { name: 'Land Information New Zealand', url: 'https://www.linz.govt.nz/', roles: ['processor', 'host'] },
    ],
    summaries: {},
  };
}
