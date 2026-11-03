import { defineConfig, getConfig, getFileExtensions, makeConfigName } from '@arthurka/eslint';

const fileExtensions = getFileExtensions(import.meta.dirname);
const config = getConfig({
  rootDirectory: import.meta.dirname,
  gitignoreFiles: ['.gitignore'],
});

export default defineConfig(
  config,
  {
    name: makeConfigName(import.meta.dirname, 'Override some rules for all files'),
    files: fileExtensions.code.all._,
    settings: {
      'import/core-modules': ['vscode'],
    },
    rules: {
      // Source targets ES2022; retain its Unicode regexp syntax.
      'require-unicode-regexp': ['warn', { requireFlag: 'u' }],
      /* @arthurka/sort-keys-block */
      '@arthurka/ts-check-directive': ['warn', 'forbid', {
        comment: 'Because of checkJs: true in tsconfig.json.',
      }],
    },
  },
);
