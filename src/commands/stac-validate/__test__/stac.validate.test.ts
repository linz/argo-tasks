import o from 'ospec';
import { listLocation, getStacSchemaUrl, normaliseHref, isURL } from '../stac.validate.js';

o.spec('stacValidate', function () {
  o('listLocation', async function () {
    o(listLocation(['s3://example-bucket/test/collection.json', 's3://example-bucket/test/item.json'])).deepEquals([
      's3://example-bucket/test/collection.json',
      's3://example-bucket/test/item.json',
    ]);
  });
  o('listLocationAwsList', async function () {
    o(listLocation(['["s3://example-bucket/test/collection.json","s3://example-bucket/test/item.json"]'])).deepEquals([
      's3://example-bucket/test/collection.json',
      's3://example-bucket/test/item.json',
    ]);
  });

  o.spec('getStacSchemaUrl', () => {
    o('should return a item url', () => {
      o(getStacSchemaUrl('Feature', '1.0.0', 'placeholder path')).equals(
        'https://schemas.stacspec.org/v1.0.0/item-spec/json-schema/item.json',
      );
    });
    o('should return a catalog url', () => {
      o(getStacSchemaUrl('Catalog', '1.0.0', 'placeholder path')).equals(
        'https://schemas.stacspec.org/v1.0.0/catalog-spec/json-schema/catalog.json',
      );
    });
    o('should return a collection url', () => {
      o(getStacSchemaUrl('Collection', '1.0.0', 'placeholder path')).equals(
        'https://schemas.stacspec.org/v1.0.0/collection-spec/json-schema/collection.json',
      );
    });
    o('should return null on invalid version', () => {
      o(getStacSchemaUrl('Collection', '0.0.8', 'placeholder path')).equals(null);
    });
    o('should return null on invalid type', () => {
      o(getStacSchemaUrl('CollectionItem', '1.0.0', 'placeholder path')).equals(null);
    });
  });

  o('isURL', () => {
    o(isURL('s3://test-bucket/test-survey/collection.json')).equals(true);
    o(isURL('data/test-survey/collection.json')).equals(false);
  });
  o('normaliseHref', () => {
    o(normaliseHref('./item.json', 's3://test-bucket/test-survey/collection.json')).equals(
      's3://test-bucket/test-survey/item.json',
    );
    o(normaliseHref('./item.json', 'data/test-survey/collection.json')).equals('data/test-survey/item.json');
    o(normaliseHref('./sub-folder/item.json', 'data/test-survey/collection.json')).equals(
      'data/test-survey/sub-folder/item.json',
    );
    o(normaliseHref('./item.json', 'collection.json')).equals('item.json');
  });
});

o.run();
