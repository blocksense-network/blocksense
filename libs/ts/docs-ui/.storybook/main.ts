import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

const require = createRequire(import.meta.url);

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(require.resolve(join(value, 'package.json')));
}

type RollupLog = { code: string; message: string };

const warningsToIgnore = {
  SOURCEMAP_ERROR: ["Can't resolve original location of error"],
  MODULE_LEVEL_DIRECTIVE: ['use client'],
};

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-a11y'),
  ],

  framework: {
    name: getAbsolutePath('@storybook/nextjs-vite'),
    options: {},
  },

  async viteFinal(config) {
    return mergeConfig(config, {
      build: {
        rollupOptions: {
          onwarn(
            warning: RollupLog,
            defaultHandler: (warning: RollupLog) => void,
          ) {
            if (warning.code in warningsToIgnore) {
              const messagesToIgnore: string[] = warningsToIgnore[warning.code];
              if (messagesToIgnore.some(m => warning.message.includes(m))) {
                return;
              }
            }
            defaultHandler(warning);
          },
        },
      },
    });
  },

  staticDirs: [
    {
      from: '../assets/fonts',
      to: 'fonts',
    },
    {
      from: '../assets/icons',
      to: 'icons',
    },
  ],
};
export default config;
