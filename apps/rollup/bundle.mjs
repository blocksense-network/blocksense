import path from 'node:path';
import fs from 'node:fs/promises';
import { rollup } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import del from 'rollup-plugin-delete';
import { glob } from 'glob';
import { createRequire } from 'node:module';
import { getTsconfig } from 'get-tsconfig';
import chalkTemplate from 'chalk-template';

main().catch(console.error);

async function main() {
  if (process.argv.length !== 3) {
    console.log(`
    Usage:
        |yarn bundle PATH|

      Called with:
        |yarn bundle${process.argv.slice(2).join(' ')}|`);
    process.exit(1);
  }

  const inputDir = process.argv[2];
  const tsConfigName = process.env['TS_CONFIG_NAME'] ?? 'tsconfig.json';
  const relativeDir = path.relative(process.env['GIT_ROOT'] ?? '/', inputDir);
  const packageDir = `${path.resolve(inputDir)}/`;

  console.log(
    chalkTemplate`╭─ Building {bold ${relativeDir}} ({underline ${packageDir}})`,
  );

  // DO NOT REMOVE: Chesterson's fence
  process.chdir(packageDir);

  await Promise.all([
    build(packageDir, relativeDir, tsConfigName, 'esm'), //
    build(packageDir, relativeDir, tsConfigName, 'cjs'),
  ]);
  await fs.rename(`${packageDir}/dist/esm/types`, `${packageDir}/dist/types`);
  console.log(
    chalkTemplate`╰─ Finished {bold ${relativeDir}/dist/\{cjs,esm,types\}} successfully.`,
  );
}

async function build(packageDir, relativeDir, tsConfigName, format) {
  let bundle;
  try {
    const config = createConfig(packageDir, tsConfigName, format);
    bundle = await rollup(config);

    for (const outputOptions of config.output) {
      await bundle.write(outputOptions);
    }
  } catch (error) {
    console.log(
      error.message
        .replace(/^\[plugin ([^\]]*)\] (\S+):/, '├─ ❌ [$2]')
        .replace(
          /^\[plugin typescript\]\s+(\S+)\s+\((\d+:\d+)\):\s+@rollup\/plugin-typescript\s+(TS\d+):/,
          '├─ ❌ $1:$2 - error $3:',
        )
        .replace(/^\s+/gm, '│       '),
    );
    if (error.frame) console.log(error.frame.replace(/^/gm, '│     '));
    console.log(chalkTemplate`╰─ {red Building {bold ${relativeDir}} failed.}`);
    process.exit(1);
  } finally {
    await bundle?.close();
  }
}

function createConfig(packageDir, tsConfigName, format) {
  const tsconfig = getTsconfig(packageDir, tsConfigName);
  const relativeRootDir = tsconfig.config.compilerOptions.rootDir;
  const sourceDir = path.resolve(packageDir, relativeRootDir ?? '.');

  return {
    preserveSymlinks: true,
    input: Object.fromEntries(
      glob
        .globSync(`${sourceDir}/**/*.ts`)
        .filter(
          file =>
            !(
              file.endsWith('.test.ts') ||
              file.endsWith('.spec.ts') ||
              file.endsWith('.d.ts')
            ),
        )
        .map(file => {
          return [
            path.relative(
              sourceDir,
              file.slice(0, file.length - path.extname(file).length),
            ),
            file,
          ];
        }),
    ),

    onwarn(warning, warn) {
      // Filter out the empty chunk warning
      // The warning code might be 'EMPTY_BUNDLE'
      if (
        warning.code === 'EMPTY_BUNDLE' ||
        (typeof warning.message === 'string' &&
          warning.message.includes('Generated an empty chunk'))
      ) {
        return;
      }
      // Handle all other warnings normally
      warn(warning);
    },

    external: (id, parentId, _isResolved) => {
      const absPath = path.isAbsolute(id)
        ? id
        : id.startsWith('.')
          ? path.resolve(parentId, id)
          : tryResolve(id, parentId);

      if (!absPath) {
        throw new Error(
          `Module ${id} was not resolved. Parent module: ${parentId}.`,
        );
      }

      return !absPath.startsWith(sourceDir);
    },
    output: [
      {
        dir: `${packageDir}/dist/${format}`,
        format: format,
        entryFileNames: `[name].${{ esm: 'mjs', cjs: 'cjs' }[format]}`,
        sourcemap: tsconfig.config.compilerOptions.sourceMap,
      },
    ],
    plugins: [
      del({ targets: `${packageDir}/dist`, force: true }),
      json({
        preferConst: true,
        namedExports: false,
      }),
      commonjs(),
      peerDepsExternal({
        packageJsonPath: path.join(packageDir, 'package.json'),
      }),
      nodeResolve({
        extensions: ['.mjs', '.cjs', '.js', '.ts', '.json'],
        preferBuiltins: true,
        // This instructs Rollup to prioritize ESM over CJS when resolving modules
        mainFields: ['module', 'main'],
        modulesOnly: true,
      }),
      typescript({
        tsconfig: `${packageDir}/${tsConfigName}`,
        composite: false,
        declaration: format != 'cjs',
        declarationMap: format != 'cjs',
        noEmitOnError: true,
        noEmit: format == 'cjs',
        /**
         * If we set `outDir` to `${packageDir}/dist/${format}`, rollup would
         * produce source maps of the form: `../../../src/array-iter.ts`,
         * instead of: `../../src/array-iter.ts`, since the source map file
         * is located at `dist/esm/array-iter.mjs.map.
         *
         * If we set `outDir` to `${packageDir}/dist` or out '..' rollup fails
         * with the following error:
         * > [@rollup/plugin-typescript] Path of Typescript compiler option
         * > 'outDir' must be located inside Rollup 'dir' option.
         *
         * For reference, see:
         * https://github.com/rollup/plugins/blob/typescript-v12.1.2/packages/typescript/src/options/validate.ts#L65
         *
         * The same error appears if we omit `outDir` from the config, so in
         * summary, the only working option is to set it explicitly to `undefined`.
         * ¯\_(ツ)_/¯
         */
        outDir: undefined,
        declarationDir:
          format == 'cjs' ? undefined : `${packageDir}/dist/${format}/types`,
      }),
    ],
  };
}

function tryResolve(id, parentId) {
  const cjsResolve = (id, parentId) => {
    const require = createRequire(parentId);
    return require.resolve(id);
  };

  for (const resolve of [import.meta.resolve, cjsResolve]) {
    try {
      return resolve(id, parentId);
    } catch (err) {
      if (process.env.DEBUG_PACKAGE_RESOLUTION?.toLowerCase() === 'yes') {
        console.log(
          '----------------------------------------------------------------------------------------------------------',
        );
        console.log(resolve.name);
        console.log({ id, parentId });
        console.log(err);
        console.log(
          '----------------------------------------------------------------------------------------------------------',
        );
      }
    }
  }

  return null;
}
