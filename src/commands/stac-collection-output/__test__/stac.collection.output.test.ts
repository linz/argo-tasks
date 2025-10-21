import assert from 'node:assert';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import { fsa, FsMemory } from '@chunkd/fs';

import { commandStacCollectionOutput, getScale, isValidGridSize } from '../stac.collection.output.ts';
import { SampleCollection } from './stac.collection.output.data.ts';

describe('stac-collection-output', () => {
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
    output: fsa.toUrl('memory:///tmp/stac-collection-output/'),
  };

  it('should retrieve output from collection', async () => {
    await commandStacCollectionOutput.handler(BaseArgs);

    const files = await fsa.toArray(fsa.list(fsa.toUrl('memory:///tmp/stac-collection-output/')));
    files.sort();
    assert.deepStrictEqual(files, [fsa.toUrl('memory:///tmp/stac-collection-output/scale')]);
    const scale = await fsa.read(fsa.toUrl('memory:///tmp/stac-collection-output/scale'));
    assert.strictEqual(scale.toString(), '1000');
  });
  it('Should return true for a valid scale', async () => {
    assert.equal(getScale(SampleCollection, collectionLocation), '1000');
  });
  it('Should throw an error if scale not found', async () => {
    SampleCollection.links = [];
    assert.throws(
      () => getScale(SampleCollection, collectionLocation),
      Error('Failed to get scale from memory:///collection.json.'),
    );
  });
});

describe('isValidGridSize', () => {
  it('Should return true for a valid scale', async () => {
    assert.equal(isValidGridSize('1000'), true);
  });
  it('Should return false for an invalid scale', async () => {
    assert.equal(isValidGridSize('750'), false);
  });
});
