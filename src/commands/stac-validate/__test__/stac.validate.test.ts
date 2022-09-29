//import { fsa } from '@chunkd/fs';
import o from 'ospec';
//import * as st from 'stac-ts';
import { getStacSchemaUrl } from '../stac.validate.js';

// const stacCollection =
//   '{"type": "Collection", "stac_version": "1.0.0", "id": "01GDBX9CHBG95NNFWDCW5EPRAD", "title": "test-title", "description": "test-description", "license": "CC-BY-4.0", "links": [{"rel": "self", "href": "./collection.json", "type": "application/json"}, {"rel": "item", "href": "s3://linz-imagery-staging/test/stac-testing/BX24_5000_0405.json", "type": "application/json"}], "extent": {"spatial": {"bbox": [1573600.0, 5179200.0, 1576000.0, 5175600.0]}, "temporal": {"interval": ["2021-12-31T11:00:00Z", "2022-02-01T11:00:00Z"]}}}';
// const stacItem =
//   '{"type": "Feature", "stac_version": "1.0.0", "id": "BX24_5000_0405", "links": [{"rel": "self", "href": "./BX24_5000_0405.json", "type": "application/json"}, {"rel": "collection", "href": "s3://linz-imagery-staging/test/stac-testing/collection.json", "type": "application/json"}, {"rel": "parent", "href": "s3://linz-imagery-staging/test/stac-testing/collection.json", "type": "application/json"}], "assets": {"visual": {"href": "s3://linz-imagery-staging/test/sample/BX24_5000_0405.tif", "type": "image/tiff; application:geotiff; profile:cloud-optimized", "file:checksum": "1220fea463513e8a25c79cc3d1d5cd3be2fb3bfd45c94235b04763f23757bc3bb33b"}}, "stac_extensions": ["https://stac-extensions.github.io/file/v2.0.0/schema.json"], "properties": {"start_datetime": "2021-12-31T11:00:00Z", "end_datetime": "2022-02-01T11:00:00Z", "datetime": null}, "geometry": {"type": "Polygon", "coordinates": [[[1573600.0, 5179200.0], [1576000.0, 5179200.0], [1576000.0, 5175600.0], [1573600.0, 5175600.0]]]}, "bbox": [1573600.0, 5179200.0, 1576000.0, 5175600.0], "collection": "test-title"}';

// const miniCollection = '{"type": "Collection"}';
// const miniItem = '{"type": "Feature"}';
// const miniSchema = '{"test"}';

o.spec('stacValidate', function () {
  o('getStacItemSchemaUrl', async function () {
    // const stacJson = await JSON.parse(stacItem);
    o(getStacSchemaUrl('Feature', '1.0.0', 'placeholder path')).equals(
      'https://schemas.stacspec.org/v1.0.0/item-spec/json-schema/item.json',
    );
  });
  o('getStacCollectionSchemaUrl', async function () {
    // const stacJson = await JSON.parse(stacCollection);
    o(getStacSchemaUrl('Collection', '1.0.0', 'placeholder path')).equals(
      'https://schemas.stacspec.org/v1.0.0/collection-spec/json-schema/collection.json',
    );
  });
  o('getStacSchemaUrlInvalidStacVersion', async function () {
    // const stacJson = await JSON.parse(stacCollection);
    o(getStacSchemaUrl('Collection', '0.0.8', 'placeholder path')).equals(null);
  });
  o('getStacSchemaUrlInvalidStacType', async function () {
    // const stacJson = await JSON.parse(stacCollection);
    o(getStacSchemaUrl('CollectionItem', '1.0.0', 'placeholder path')).equals(null);
  });
});
