import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Architectural boundaries from ARCHITECTURE.md are enforced here where a lint rule can express them.
const hostOnlyPackages = [
  '@playhoot/app-core',
  '@playhoot/communication',
  '@playhoot/device',
  '@playhoot/game-host',
  '@playhoot/feature-*',
  '@playhoot/web',
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Shared packages never depend on an app shell or on a platform renderer/router.
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@playhoot/web', '@playhoot/mobile'],
              message: 'Packages must not depend on an app shell.',
            },
            {
              group: [
                'react-dom',
                'react-dom/*',
                'react-native',
                'react-router',
                'react-router-dom',
              ],
              message: 'Platform renderers/routers belong to apps/*.',
            },
          ],
        },
      ],
    },
  },
  {
    // The Game SDK runs inside the untrusted game artifact: only web standards and the bridge protocol.
    files: ['packages/game-sdk/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playhoot/protocol',
              message: 'Import only @playhoot/protocol/bridge from the Game SDK.',
            },
          ],
          patterns: [
            {
              group: hostOnlyPackages,
              message: 'The Game SDK must not depend on trusted Host code.',
            },
            {
              group: ['react', 'react-*', 'react/*'],
              message: 'The Game SDK must not depend on a UI framework.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.{js,ts}', 'apps/*/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
