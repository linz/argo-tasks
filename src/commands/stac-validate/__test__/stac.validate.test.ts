import assert from 'node:assert';
import { describe, it } from 'node:test';

import { getStacSchemaUrl, listLocation } from '../stac.validate.js';

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
});
