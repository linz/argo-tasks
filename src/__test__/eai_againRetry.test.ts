import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import type { BuildHandler, MetadataBearer } from '@smithy/types';

import { eaiAgainBuilder } from '../fs.register.ts';

let callCount = 0;

function fakeNextBuilder(failCount: number): BuildHandler<object, MetadataBearer> {
  const fakeNext: BuildHandler<object, MetadataBearer> = () => {
    // fail a specified number of times and then succeed
    callCount += 1;
    if (callCount < 1 + failCount) {
      return Promise.reject({ code: 'EAI_AGAIN', hostname: 'nz-imagery.s3.ap-southeast-2.amazonaws.com' });
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
    const fakeNext = fakeNextBuilder(0);
    eaiAgainBuilder(() => 0)(fakeNext, {})({ input: {}, request: {} });
    assert.equal(callCount, 1);
  });

  it('should try three times when getting EAI_AGAIN errors', async () => {
    const fakeNext = fakeNextBuilder(2);
    await eaiAgainBuilder(() => 0)(fakeNext, {})({ input: {}, request: {} });
    assert.equal(callCount, 3);
  });

  it('should throw error if fails with unknown error type', () => {
    const fakeNext: BuildHandler<object, MetadataBearer> = () => {
      return Promise.reject({ message: 'ERROR MESSAGE' });
    };
    assert.rejects(eaiAgainBuilder(() => 0)(fakeNext, {})({ input: {}, request: {} }), {
      message: 'ERROR MESSAGE',
    });
  });

  it('should throw error if next fails with EAI_AGAIN three times', () => {
    const fakeNext = fakeNextBuilder(3);
    assert.rejects(eaiAgainBuilder(() => 0)(fakeNext, {})({ input: {}, request: {} }), {
      message: 'EAI_AGAIN maximum tries (3) exceeded',
    });
  });
});
