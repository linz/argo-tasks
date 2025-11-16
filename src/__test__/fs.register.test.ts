import { describe, it } from 'node:test';

import assert from 'assert';

import { splitConfig } from '../fs.register.ts';

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
