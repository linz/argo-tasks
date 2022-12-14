import o from 'ospec';
import { iri, iriReference, getStacSchemaUrl, normaliseHref } from '../stac.validate.js';

o.spec('stacValidate', function () {
  o('iriEmptyString', async function () {
    o(iri('')).equals(false);
  });
  o('iriString', async function () {
    o(iri('test/')).equals(false);
  });
  o('iriStringHttp', async function () {
    o(iri('https://schemas.stacspec.org/v1.0.0/item-spec/json-schema/item.json')).equals(true);
  });
  o('iriReferenceEmptyString', async function () {
    o(iriReference('')).equals(false);
  });
  o('iriReferenceString', async function () {
    o(iriReference('test/')).equals(false);
  });
  o('iriReferenceStringHttp', async function () {
    o(iriReference('https://schemas.stacspec.org/')).equals(true);
  });
  o('getStacItemSchemaUrl', async function () {
    o(getStacSchemaUrl('Feature', '1.0.0', 'placeholder path')).equals(
      'https://schemas.stacspec.org/v1.0.0/item-spec/json-schema/item.json',
    );
  });
  o('getStacCollectionSchemaUrl', async function () {
    o(getStacSchemaUrl('Collection', '1.0.0', 'placeholder path')).equals(
      'https://schemas.stacspec.org/v1.0.0/collection-spec/json-schema/collection.json',
    );
  });
  o('getStacSchemaUrlInvalidStacVersion', async function () {
    o(getStacSchemaUrl('Collection', '0.0.8', 'placeholder path')).equals(null);
  });
  o('getStacSchemaUrlInvalidStacType', async function () {
    o(getStacSchemaUrl('CollectionItem', '1.0.0', 'placeholder path')).equals(null);
  });
  o('normaliseHref', async function () {
    o(normaliseHref('./item.json', 's3://test-bucket/test-survey/collection.json')).equals(
      's3://test-bucket/test-survey/item.json',
    );
  });
});
