import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import * as st from 'stac-ts';

import {
  getStacSchemaUrl,
  isURL,
  listLocation,
  normaliseHref,
  validateAssets,
  validateLinks,
  validateStacChecksum,
} from '../stac.validate.js';

describe('stacValidate', function () {
  it('listLocation', async function () {
    assert.deepEqual(listLocation(['s3://example-bucket/test/collection.json', 's3://example-bucket/test/item.json']), [
      's3://example-bucket/test/collection.json',
      's3://example-bucket/test/item.json',
    ]);
  });
  it('listLocationAwsList', async function () {
    assert.deepEqual(
      listLocation(['["s3://example-bucket/test/collection.json","s3://example-bucket/test/item.json"]']),
      ['s3://example-bucket/test/collection.json', 's3://example-bucket/test/item.json'],
    );
  });

  describe('getStacSchemaUrl', () => {
    it('should return a item url', () => {
      assert.equal(
        getStacSchemaUrl('Feature', '1.0.0', 'placeholder path'),
        'https://schemas.stacspec.org/v1.0.0/item-spec/json-schema/item.json',
      );
    });
    it('should return a catalog url', () => {
      assert.equal(
        getStacSchemaUrl('Catalog', '1.0.0', 'placeholder path'),
        'https://schemas.stacspec.org/v1.0.0/catalog-spec/json-schema/catalog.json',
      );
    });
    it('should return a collection url', () => {
      assert.equal(
        getStacSchemaUrl('Collection', '1.0.0', 'placeholder path'),
        'https://schemas.stacspec.org/v1.0.0/collection-spec/json-schema/collection.json',
      );
    });
    it('should return null on invalid version', () => {
      assert.equal(getStacSchemaUrl('Collection', '0.0.8', 'placeholder path'), null);
    });
    it('should return null on invalid type', () => {
      assert.equal(getStacSchemaUrl('CollectionItem', '1.0.0', 'placeholder path'), null);
    });
  });

  it('isURL', () => {
    assert.equal(isURL('s3://test-bucket/test-survey/collection.json'), true);
    assert.equal(isURL('data/test-survey/collection.json'), false);
  });
  it('normaliseHref', () => {
    assert.equal(
      normaliseHref('./item.json', 's3://test-bucket/test-survey/collection.json'),
      's3://test-bucket/test-survey/item.json',
    );
    assert.equal(normaliseHref('./item.json', 'data/test-survey/collection.json'), 'data/test-survey/item.json');
    assert.equal(
      normaliseHref('./sub-folder/item.json', 'data/test-survey/collection.json'),
      'data/test-survey/sub-folder/item.json',
    );
    assert.equal(normaliseHref('./item.json', 'collection.json'), 'item.json');
  });

  describe('validate checksum', () => {
    const memory = new FsMemory();
    const path = 'memory://stac/';

    before(() => {
      fsa.register('memory://', memory);
    });
    beforeEach(() => memory.files.clear());

    it('should validate a valid checksum', async () => {
      await fsa.write(`${path}item.json`, Buffer.from(JSON.stringify({ test: true })));
      const link: st.StacLink = {
        href: './item.json',
        rel: 'item',
        'file:checksum': '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
      };

      const isValid = await validateStacChecksum(link, `${path}collection.json`, false);
      assert.equal(isValid, true);
    });
    it('should return the path of an asset with invalid checksum', async () => {
      await fsa.write(`${path}image.tiff`, Buffer.from('test'));
      const stacItem: st.StacItem = {
        type: 'Feature',
        stac_version: '1.0.0',
        id: 'item',
        links: [],
        assets: {
          visual: {
            href: './image.tiff',
            'file:checksum': '12206fabcd',
          },
        },
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [],
        },
      };

      const errors = await validateAssets(stacItem, `${path}item.json`);
      assert.equal(errors.length, 1);
    });
    it('should validate a valid link checksum', async () => {
      await fsa.write(`${path}item.json`, Buffer.from(JSON.stringify({ test: true })));
      const stacCollection: st.StacCollection = {
        type: 'Collection',
        stac_version: '1.0.0',
        id: 'collection',
        description: 'desc',
        license: 'lic',
        links: [
          {
            rel: 'item',
            href: './item.json',
            type: 'application/json',
            'file:checksum': '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e',
          },
        ],
        extent: {
          spatial: { bbox: [[]] },
          temporal: { interval: [['2023-10-10T11:00:00Z', '2023-10-27T11:00:00Z']] },
        },
      };

      const errors = await validateLinks(stacCollection, `${path}item.json`);
      assert.equal(errors.length, 0);
    });
  });
});
