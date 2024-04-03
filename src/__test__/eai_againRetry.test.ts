import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { BuildHandler, MetadataBearer } from '@smithy/types';

import { eaiAgainBuilder } from '../fs.register.js';

let callCount = 0;

function buildFakeNext(failCount: number): BuildHandler<object, MetadataBearer> {
  const fakeNext: BuildHandler<object, MetadataBearer> = () => {
    // fail twice and then succeed
    callCount += 1;
    if (callCount < 1 + failCount) {
      return Promise.reject({ code: 'EAI_AGAIN' });
    } else {
      return Promise.resolve({ output: { $metadata: {} }, response: {} });
    }
  };
  return fakeNext;
}

describe('eai_againRetryMiddleware', () => {
  beforeEach(() => {
    callCount = 0;
  });
  it('should run next once if it succeeds', () => {
    const fakeNext = buildFakeNext(0);
    eaiAgainBuilder(0)(fakeNext, {})({ input: {}, request: {} });
    assert.equal(callCount, 1);
  });

  it('should try three times when getting EAI_AGAIN errors', async () => {
    const fakeNext = buildFakeNext(2);
    await eaiAgainBuilder(0)(fakeNext, {})({ input: {}, request: {} });
    assert.equal(callCount, 3);
  });

  it('should throw error if next fails three times', () => {
    const fakeNext = buildFakeNext(3);
    assert.rejects(eaiAgainBuilder(0)(fakeNext, {})({ input: {}, request: {} }), {
      message: 'EAI_AGAIN maximum tries (3) exceeded',
    });
  });
});
