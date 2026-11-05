import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig(
  globalIgnores([
    'dist/**',
    'dist-ssr/**',
    'artifacts/**',
    'test-results/**',
    'playwright-report/**',
    'auto-imports.d.ts',
    'components.d.ts',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,vue}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx,vue}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
    rules: { 'vue/multi-word-component-names': ['error', { ignores: ['Forbidden'] }] },
  },
  {
    files: ['src/**/*.{js,ts,tsx,vue}', 'tests/fixtures/**/*.vue'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.{js,mjs,cjs,ts}', 'mock/**/*.ts', 'tests/**/*.{cjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['tests/e2e/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  prettier,
);
