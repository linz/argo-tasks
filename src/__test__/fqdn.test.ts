import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { FinalizeHandler, MetadataBearer } from '@smithy/types';

import { fqdn } from '../fs.register.ts';

describe('fqdnMiddleware', () => {
  const fakeNext: FinalizeHandler<object, MetadataBearer> = () => {
    return Promise.resolve({ output: { $metadata: {} }, response: {} });
  };
  const fakeRequest = { input: {}, request: { hostname: 'nz-imagery.s3.ap-southeast-2.amazonaws.com' } };

  it('should add FQDN to s3 requests', () => {
    fakeRequest.request.hostname = 'nz-imagery.s3.ap-southeast-2.amazonaws.com';
    fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'nz-imagery.s3.ap-southeast-2.amazonaws.com.');
  });

  it('should not add for other services', () => {
    fakeRequest.request.hostname = 'logs.ap-southeast-2.amazonaws.com';
    fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'logs.ap-southeast-2.amazonaws.com');
  });

  it('should not add for other regions', () => {
    fakeRequest.request.hostname = 'nz-imagery.s3.us-east-1.amazonaws.com';
    fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'nz-imagery.s3.us-east-1.amazonaws.com');
  });

  it('should not add for unknown hosts', () => {
    fakeRequest.request.hostname = 'google.com';
    fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'google.com');
  });
});
