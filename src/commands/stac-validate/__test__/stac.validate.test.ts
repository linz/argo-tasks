import { describe, it } from 'node:test';
import assert from 'node:assert';
import { listLocation, getStacSchemaUrl, normaliseHref, isURL } from '../stac.validate.js';

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
});
