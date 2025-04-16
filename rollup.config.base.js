// rollup.config.base.js
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

/**
 * @param {Object} options
 * @param {string[]} options.input - List of entry files (e.g., ['./src/index.ts'])
 * @param {string} options.srcDir - Source root (e.g., 'src')
 * @param {string} options.outputDir - Output base directory (e.g., 'dist')
 */
export function createRollupConfig({ input, srcDir, outputDir }) {
  const preserveModulesOptions = {
    preserveModules: true,
    preserveModulesRoot: srcDir,
  };

  return [
    // ESM
    {
      input,
      output: {
        dir: path.join(outputDir, 'esm'),
        format: 'esm',
        entryFileNames: '[name].mjs',
      },
      ...preserveModulesOptions,
      plugins: [
        resolve(),
        commonjs(),
        typescript({ tsconfig: './tsconfig.json', declaration: false }),
      ],
    },

    // CJS
    {
      input,
      output: {
        dir: path.join(outputDir, 'cjs'),
        format: 'cjs',
        entryFileNames: '[name].cjs',
      },
      ...preserveModulesOptions,
      plugins: [
        resolve(),
        commonjs(),
        typescript({ tsconfig: './tsconfig.json', declaration: false }),
      ],
    },

    // Declarations
    {
      input,
      output: {
        dir: path.join(outputDir, 'types'),
        format: 'es',
        entryFileNames: '[name].d.ts',
      },
      ...preserveModulesOptions,
      plugins: [dts()],
    },
  ];
}
