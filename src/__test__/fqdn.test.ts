import type { FinalizeHandler, MetadataBearer } from '@smithy/types';
import assert from 'node:assert';
import { describe, it } from 'node:test';

import { fqdn } from '../fs.register.ts';

describe('fqdnMiddleware', () => {
  const fakeNext: FinalizeHandler<object, MetadataBearer> = () => {
    return Promise.resolve({ output: { $metadata: {} }, response: {} });
  };
  const fakeRequest = { input: {}, request: { hostname: 'nz-imagery.s3.ap-southeast-2.amazonaws.com' } };

  it('should add FQDN to s3 requests', async () => {
    fakeRequest.request.hostname = 'nz-imagery.s3.ap-southeast-2.amazonaws.com';
    await fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'nz-imagery.s3.ap-southeast-2.amazonaws.com.');
  });

  it('should not add for other services', async () => {
    fakeRequest.request.hostname = 'logs.ap-southeast-2.amazonaws.com';
    await fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'logs.ap-southeast-2.amazonaws.com');
  });

  it('should not add for other regions', async () => {
    fakeRequest.request.hostname = 'nz-imagery.s3.us-east-1.amazonaws.com';
    await fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'nz-imagery.s3.us-east-1.amazonaws.com');
  });

  it('should not add for unknown hosts', async () => {
    fakeRequest.request.hostname = 'google.com';
    await fqdn(fakeNext, {})(fakeRequest);
    assert.equal(fakeRequest.request.hostname, 'google.com');
  });
});
