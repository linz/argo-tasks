import assert from 'node:assert';
import { describe, it } from 'node:test';

import prettier from 'prettier';

import { DEFAULT_PRETTIER_FORMAT } from "../config.ts";

describe('DefaultPrettierFormat', () => {
  it('should be the same prettier format with @linzjs/style', async () => {
    const cfg = await prettier.resolveConfigFile('@linzjs/style/.prettierrc.cjs');
    assert.ok(cfg, 'Failed to read @linzjs/style/.prettierrc.cjs');
    const options = await prettier.resolveConfig(cfg);
    assert.ok(options, 'Failed to resolve prettier config');

    assert.equal(DEFAULT_PRETTIER_FORMAT.semi, options.semi, 'prettier.semi');
    assert.equal(DEFAULT_PRETTIER_FORMAT.trailingComma, options.trailingComma, 'prettier.trailingComma');
    assert.equal(DEFAULT_PRETTIER_FORMAT.printWidth, options.printWidth, 'prettier.printWidth');
    assert.equal(DEFAULT_PRETTIER_FORMAT.useTabs, options.useTabs, 'prettier.useTabs');
    assert.equal(DEFAULT_PRETTIER_FORMAT.tabWidth, options.tabWidth, 'prettier.tabWidth');
  });
});
