import assert from 'node:assert';
import { describe, it } from 'node:test';

import { DEFAULT_FORMAT } from '../../../utils/config.ts';
import { prettyPrint } from '../pretty.print.ts';

// Expected output was generated with prettier 3 and must not change when the formatter is upgraded
const collection = {
  type: 'Collection',
  title: 'Manawatū-Whanganui 0.3m Rural Aerial Photos (2021-2022)',
  links: [
    { rel: 'self', href: './collection.json', type: 'application/json' },
    {
      rel: 'item',
      href: './BJ34_5000_0101.json',
      type: 'application/json',
      'file:checksum': '1220e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  ],
  extent: { spatial: { bbox: [[174.7024167, -40.6438003, 176.0583254, -39.8147289]] } },
  keywords: [],
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [175.1, -40.1],
        [175.2, -40.1],
        [175.1, -40.2],
        [175.1, -40.1],
      ],
    ],
  },
};

describe('prettyPrint', () => {
  it('should format STAC JSON', async () => {
    const expected = `{
  "type": "Collection",
  "title": "Manawatū-Whanganui 0.3m Rural Aerial Photos (2021-2022)",
  "links": [
    { "rel": "self", "href": "./collection.json", "type": "application/json" },
    {
      "rel": "item",
      "href": "./BJ34_5000_0101.json",
      "type": "application/json",
      "file:checksum": "1220e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ],
  "extent": { "spatial": { "bbox": [[174.7024167, -40.6438003, 176.0583254, -39.8147289]] } },
  "keywords": [],
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [175.1, -40.1],
        [175.2, -40.1],
        [175.1, -40.2],
        [175.1, -40.1]
      ]
    ]
  }
}
`;
    assert.equal(await prettyPrint(JSON.stringify(collection), DEFAULT_FORMAT), expected);
  });

  it('should keep objects expanded when the input is indented', async () => {
    const expected = `{
  "type": "Collection",
  "title": "Manawatū-Whanganui 0.3m Rural Aerial Photos (2021-2022)",
  "links": [
    {
      "rel": "self",
      "href": "./collection.json",
      "type": "application/json"
    },
    {
      "rel": "item",
      "href": "./BJ34_5000_0101.json",
      "type": "application/json",
      "file:checksum": "1220e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ],
  "extent": {
    "spatial": {
      "bbox": [[174.7024167, -40.6438003, 176.0583254, -39.8147289]]
    }
  },
  "keywords": [],
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [175.1, -40.1],
        [175.2, -40.1],
        [175.1, -40.2],
        [175.1, -40.1]
      ]
    ]
  }
}
`;
    const config = { ...DEFAULT_FORMAT, printWidth: 200 };
    assert.equal(await prettyPrint(JSON.stringify(collection, null, 2), config), expected);
  });

  it('should throw on invalid JSON', async () => {
    await assert.rejects(prettyPrint('{"a": }', DEFAULT_FORMAT), { message: /Failed to format JSON/ });
  });
});
