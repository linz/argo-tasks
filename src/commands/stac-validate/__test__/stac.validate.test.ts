import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fsa } from '@chunkd/fs';
import { FsMemory } from '@chunkd/source-memory';
import * as st from 'stac-ts';

import { getStacSchemaUrl, isURL, listLocation, normaliseHref, validateChecksum } from '../stac.validate.js';

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
  it('validateChecksum', async () => {
    const memory = new FsMemory();
    fsa.register('memory://', memory);
    const path = 'memory://stac/';
    await fsa.write(`${path}item.json`, Buffer.from(JSON.stringify({ test: true })), {
      contentType: 'application/json',
    });
    const link: st.StacLink = { href: './item.json', rel: 'item' };
    link['file:checksum'] = '12206fd977db9b2afe87a9ceee48432881299a6aaf83d935fbbe83007660287f9c2e';
    const isValid = await validateChecksum(link, `${path}collection.json`, { allowMissing: true, allowUnknown: false });
    assert.equal(isValid, true);
    memory.files.clear();
  });
});
