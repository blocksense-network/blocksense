import path from 'node:path';
import { fileURLToPath } from 'node:url';

import effectEsLintPlugin from '@effect/eslint-plugin';
import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import codegen from 'eslint-plugin-codegen';
import _import from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sortDestructureKeys from 'eslint-plugin-sort-destructure-keys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/docs',
      '**/*.md',
      '.yarn/**',
      '.pnp.cjs',
      '.prettierrc.cjs',
      'libs/aztec_contracts',
      'libs/ts/contracts',
      'libs/ts/contracts/typechain',
      'libs/ts/decoders',
      'libs/ts/esbuild-react-compiler-plugin',
      'libs/ts/nextra-theme-docs',
      'libs/ts/sol-reflector',
      'apps/docs.blocksense.network',
      'apps/rollup',
      'scripts/',
    ],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ),
  {
    plugins: {
      import: fixupPluginRules(_import),
      'sort-destructure-keys': sortDestructureKeys,
      'simple-import-sort': simpleImportSort,
      codegen,
      effectEsLintPlugin,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'module',
    },

    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },

      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },

    rules: {
      'codegen/codegen': 'error',
      'no-fallthrough': 'off',
      'no-irregular-whitespace': 'off',
      'object-shorthand': 'error',
      'prefer-destructuring': 'off',
      'sort-imports': 'off',
      'no-unused-vars': 'off',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',

      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',
      'import/order': 'off',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. Side effect imports
            ['^\\u0000'],
            // 2. Node.js built-ins
            [
              '^(node:)?(assert|buffer|child_process|cluster|crypto|dgram|dns|domain|events|fs|http|http2|https|inspector|module|net|os|path|perf_hooks|process|punycode|querystring|readline|repl|stream|string_decoder|timers|tls|trace_events|tty|url|util|v8|vm|worker_threads|zlib)(/|$)',
            ],
            // 3. External packages (react and effect-related first)
            ['^react$', '^react-dom$', '^effect', '^@effect/', '^@?\\w'],
            // 4. Internal monorepo packages (adjust these aliases if needed)
            ['^@blocksense/', '^@apps/', '^@libs/', '^@/'],
            // 5. Absolute imports (capitalized or other root based)
            ['^[A-Z]'],
            // 6. Parent imports
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // 7. Sibling & index
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // 8. Style imports
            ['^.+\\.s?css$'],
          ],
        },
      ],
      'sort-destructure-keys/sort-destructure-keys': 'error',
      'deprecation/deprecation': 'off',

      '@typescript-eslint/array-type': [
        'warn',
        {
          default: 'array-simple',
          readonly: 'array-simple',
        },
      ],

      '@typescript-eslint/member-delimiter-style': 0,
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-array-constructor': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
    },
  },
];
