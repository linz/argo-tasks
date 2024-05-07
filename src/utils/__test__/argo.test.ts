import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { getActionLocation } from '../action.storage.js';

void describe('argoLocation', () => {
  beforeEach(() => {
    delete process.env['ARGO_TEMPLATE'];
    delete process.env['ARGO_NODE_ID'];
  });
  void it("should not die if ARGO_TEMPLATE doesn't exist", () => {
    delete process.env['ARGO_TEMPLATE'];
    assert.equal(getActionLocation(), null);
  });

  void it('should not die if ARGO_TEMPLATE in missing keys', () => {
    process.env['ARGO_TEMPLATE'] = '{}';
    assert.equal(getActionLocation(), null);

    process.env['ARGO_TEMPLATE'] = JSON.stringify({ archiveLocation: {} });
    assert.equal(getActionLocation(), null);

    process.env['ARGO_TEMPLATE'] = JSON.stringify({ archiveLocation: { s3: {} } });
    assert.equal(getActionLocation(), null);
  });

  void it('should actually parse the ARGO_TEMPLATE', () => {
    process.env['ARGO_NODE_ID'] = 'test-env-n9d2x';
    process.env['ARGO_TEMPLATE'] = JSON.stringify({
      name: 'env',
      inputs: {},
      outputs: {},
      metadata: {},
      container: { name: '', image: 'ubuntu:22.04', command: ['env'], resources: {} },
      archiveLocation: {
        archiveLogs: true,
        s3: {
          endpoint: 's3.amazonaws.com',
          bucket: 'linz-nonprod-workflow-artifacts',
          region: 'ap-southeast-2',
          insecure: false,
          accessKeySecret: { key: 'accesskey' },
          secretKeySecret: { key: 'secretkey' },
          useSDKCreds: true,
          key: '2022-11/02-test-env-n9d2x/test-env-n9d2x',
        },
      },
    });

    assert.equal(getActionLocation(), 's3://linz-nonprod-workflow-artifacts/2022-11/02-test-env-n9d2x');
  });
});
