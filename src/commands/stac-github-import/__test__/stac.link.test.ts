import assert from 'node:assert';
import { describe, it } from 'node:test';

import { sortLinks } from "../stac.github.import.ts";

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    const randomItem = array[randomIndex] as T;
    const currentItem = array[currentIndex] as T;
    array[currentIndex] = randomItem;
    array[randomIndex] = currentItem;
  }

  return array;
}

describe('sortLinks', () => {
  it('should make root first', () => {
    const links = [
      { rel: 'self', href: './collection.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4643.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4844.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2932.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4750.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4807.json', type: 'application/json' },
      {
        rel: 'root',
        href: 'https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'item', href: './AY31_1000_4809.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4808.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2934.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4744.json', type: 'application/json' },
    ];
    sortLinks(links);
    assert.equal(links[0]?.rel, 'root');
  });

  it('should sort alphabetically the items', () => {
    const links = [
      { rel: 'self', href: './collection.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4643.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4844.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2932.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4750.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4807.json', type: 'application/json' },
      {
        rel: 'root',
        href: 'https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'item', href: './AY31_1000_4809.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4808.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2934.json', type: 'application/json' },
      { rel: 'item', href: './AY30_1000_4744.json', type: 'application/json' },
    ];
    sortLinks(links);
    const items = links.filter((f) => f.rel === 'item').map((f) => f.href);
    assert.deepEqual(items, [
      './AY30_1000_4643.json',
      './AY30_1000_4744.json',
      './AY30_1000_4844.json',
      './AY31_1000_2932.json',
      './AY31_1000_2934.json',
      './AY31_1000_4750.json',
      './AY31_1000_4807.json',
      './AY31_1000_4808.json',
      './AY31_1000_4809.json',
    ]);
  });

  it('should be stable', () => {
    const links = [
      { rel: 'self', href: './collection.json', type: 'application/json' },
      { rel: 'test', href: './AY30_1000_4643.json', type: 'application/json' },
      { rel: 'item', href: './AY30_100_4844.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_2932.json', type: 'application/json' },
      { rel: 'item', href: './AY31_10_4750.json', type: 'application/json' },
      { rel: 'item', href: './AY31_1000_4807.json', type: 'application/json' },
      {
        rel: 'root',
        href: 'https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json',
        type: 'application/json',
      },
      { rel: 'self', href: './AY31_500_4809.json', type: 'application/json' },
      { rel: 'item', href: './AY32_1000_4808.json', type: 'application/json' },
      { rel: 'root', href: 'https://AZ31_1000_2934.json', type: 'application/json' },
      { rel: 'fake', href: './AY30_1000_4744.json', type: 'application/json' },
    ];

    sortLinks(links);
    const sorted = links.map((f) => f.href);

    for (let i = 0; i < 1000; i++) {
      const shuffled = shuffle(links);
      sortLinks(shuffled);
      assert.deepEqual(
        shuffled.map((f) => f.href),
        sorted,
      );
    }
  });
});
