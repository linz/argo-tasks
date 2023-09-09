import assert from 'node:assert';
import { describe, it } from 'node:test';

import prettier from 'prettier';

import { DefaultPrettierFormat } from '../make.cog.github.js';

describe('DefaultPrettierFormat', () => {
  it('should be the same prettier format with @linzjs/style', async () => {
    const cfg = await prettier.resolveConfigFile('@linzjs/style/.prettierrc.cjs');
    if (cfg == null) assert.ok(cfg !== null, 'Failed to read @linzjs/style/.prettierrc.cjs');
    const options = await prettier.resolveConfig(cfg);
    if (options == null) assert.ok(options !== null, 'Failed to resolve prettier config');

    assert.equal(DefaultPrettierFormat.semi, options.semi, 'prettier.semi');
    assert.equal(DefaultPrettierFormat.trailingComma, options.trailingComma, 'prettier.trailingComma');
    assert.equal(DefaultPrettierFormat.printWidth, options.printWidth, 'prettier.printWidth');
    assert.equal(DefaultPrettierFormat.useTabs, options.useTabs, 'prettier.useTabs');
    assert.equal(DefaultPrettierFormat.tabWidth, options.tabWidth, 'prettier.tabWidth');
  });
});
