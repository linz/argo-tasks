import base from '@linzjs/style/oxlint.config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [base],
  env: {
    node: true,
    es2023: true,
  },
  rules: {
    // node runs .ts directly and needs "import type" when importing types
    'typescript/consistent-type-imports': 'error',
    // node:test describe/it return promises that the test runner handles
    'typescript/no-floating-promises': [
      'warn',
      {
        allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['describe', 'it', 'test', 'suite'] }],
      },
    ],
  },
});
