import { S3Client } from '@aws-sdk/client-s3';
import assert from 'assert';
import { describe, it } from 'node:test';

import { skipResponseChecksumValidation, splitConfig } from '../fs.register.ts';

describe('skipResponseChecksumValidation', () => {
  it('should default to WHEN_REQUIRED', () => {
    const env: NodeJS.ProcessEnv = {};
    skipResponseChecksumValidation(env);
    assert.equal(env['AWS_RESPONSE_CHECKSUM_VALIDATION'], 'WHEN_REQUIRED');
  });

  it('should keep an existing value', () => {
    const env: NodeJS.ProcessEnv = { AWS_RESPONSE_CHECKSUM_VALIDATION: 'WHEN_SUPPORTED' };
    skipResponseChecksumValidation(env);
    assert.equal(env['AWS_RESPONSE_CHECKSUM_VALIDATION'], 'WHEN_SUPPORTED');
  });

  it('should apply to new S3 clients', async () => {
    const previous = process.env['AWS_RESPONSE_CHECKSUM_VALIDATION'];
    delete process.env['AWS_RESPONSE_CHECKSUM_VALIDATION'];
    try {
      skipResponseChecksumValidation();
      const client = new S3Client({ region: 'ap-southeast-2' });
      assert.equal(await client.config.responseChecksumValidation(), 'WHEN_REQUIRED');
    } finally {
      if (previous == null) delete process.env['AWS_RESPONSE_CHECKSUM_VALIDATION'];
      else process.env['AWS_RESPONSE_CHECKSUM_VALIDATION'] = previous;
    }
  });
});

describe('splitConfig', () => {
  it('should parse JSON array string', () => {
    const result = splitConfig('["config1.json", "config2.json", "config3.json"]');
    assert.deepEqual(result, ['config1.json', 'config2.json', 'config3.json']);
  });

  it('should parse empty JSON array', () => {
    const result = splitConfig('[]');
    assert.deepEqual(result, []);
  });

  it('should split comma-separated string', () => {
    const result = splitConfig('config1.json,config2.json,config3.json');
    assert.deepEqual(result, ['config1.json', 'config2.json', 'config3.json']);
  });

  it('should handle single value without commas', () => {
    const result = splitConfig('config.json');
    assert.deepEqual(result, ['config.json']);
  });

  it('should trim whitespace from comma-separated values', () => {
    const result = splitConfig('config1.json, config2.json , config3.json');
    assert.deepEqual(result, ['config1.json', 'config2.json', 'config3.json']);
  });

  it('should filter out empty strings from comma-separated values', () => {
    const result = splitConfig('config1.json,,config2.json,');
    assert.deepEqual(result, ['config1.json', 'config2.json']);
  });

  it('should handle empty string', () => {
    const result = splitConfig('');
    assert.deepEqual(result, []);
  });
});
