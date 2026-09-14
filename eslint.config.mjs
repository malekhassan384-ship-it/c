import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const NODE_GLOBALS = {
  process: 'readonly', console: 'readonly', Buffer: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  fetch: 'readonly', URL: 'readonly', __dirname: 'readonly', require: 'readonly', module: 'writable'
};

export default tseslint.config(
  {
    ignores: ['build/**', 'dist/**', 'node_modules/**', 'out/**', 'resources/engines/**', 'scripts/.cache/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: { globals: NODE_GLOBALS }
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-undef': 'off', // TS handles this; avoids false positives for Node/DOM globals
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off'
    }
  }
);
