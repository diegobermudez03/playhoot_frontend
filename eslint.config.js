import js from '@eslint/js';
import formatjs from 'eslint-plugin-formatjs';
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
            {
              name: '@playhoot/protocol/bridge/validation',
              message: 'Host-side validation (zod) must not be bundled into game artifacts.',
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
    // The game logic packages are bundled into the backend sandbox script: no UI, no browser, no
    // Host code (docs/projects/active/game-creation-web-v1).
    files: ['packages/game-core/**/*.{ts,tsx}', 'packages/game-server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@playhoot/*', '!@playhoot/game-core'],
              message: 'Game logic packages depend only on @playhoot/game-core.',
            },
            {
              group: ['react', 'react-*', 'react/*'],
              message: 'Game logic runs in the backend sandbox, without a UI framework.',
            },
          ],
        },
      ],
    },
  },
  {
    // The React surface of a game's client renders inside the untrusted game frame, so it owns its
    // renderer (react-dom), and reaches the Host only through the Game SDK.
    files: ['packages/game-react/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...hostOnlyPackages, '@playhoot/protocol', '@playhoot/protocol/*'],
              message: 'A game client uses Playhoot only through @playhoot/game-sdk.',
            },
          ],
        },
      ],
    },
  },
  {
    // Fixture games are untrusted game artifacts: they see Playhoot only through the Game SDK.
    files: ['fixtures/games/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...hostOnlyPackages, '@playhoot/protocol', '@playhoot/protocol/*'],
              message: 'A game uses Playhoot only through @playhoot/game-sdk.',
            },
          ],
        },
      ],
    },
  },
  {
    // Every text a person reads comes from the message catalogs (docs/design/DESIGN_SYSTEM.md, i18n).
    // Development-only tools and tests may use literal text.
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/dev/**', '**/*.test.tsx'],
    plugins: { formatjs },
    rules: {
      'formatjs/no-literal-string-in-jsx': [
        'error',
        { props: { include: [['*', '{label,placeholder,title,hint,alt}']] } },
      ],
    },
  },
  {
    files: [
      '*.{js,ts}',
      'apps/*/*.{js,ts}',
      'scripts/**/*.{js,mjs}',
      'fixtures/games/*/*.{js,mjs}',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
);
