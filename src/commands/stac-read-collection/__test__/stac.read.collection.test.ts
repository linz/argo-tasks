import assert from 'node:assert';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { commandStacReadCollection } from '../stac.read.collection.ts';
import { SampleCollection } from './stac.read.collection.data.ts';

describe('stac-read-collection', () => {
  const mem = new FsMemory();
  const collectionLocation = fsa.toUrl('memory:///collection.json');

  before(() => {
    fsa.register('memory:///', mem); // use 3 slashes to ensure URL is correct (otherwise filename is used as the host)
  });

  beforeEach(async () => {
    await fsa.write(collectionLocation, JSON.stringify(SampleCollection));
  });

  afterEach(() => {
    mem.files.clear();
  });

  const BaseArgs = {
    config: undefined,
    verbose: false,
    odrUrl: collectionLocation,
    output: fsa.toUrl('memory:///tmp/stac-read-collection/'),
  };

  it('should retrieve scale from collection', async () => {
    await commandStacReadCollection.handler(BaseArgs);

    const files = await fsa.toArray(fsa.list(fsa.toUrl('memory:///tmp/stac-read-collection/')));
    files.sort();
    assert.deepStrictEqual(files, [fsa.toUrl('memory:///tmp/stac-read-collection/scale')]);
    const scale = await fsa.read(fsa.toUrl('memory:///tmp/stac-read-collection/scale'));
    assert.strictEqual(scale.toString(), '1000');
  });
});
