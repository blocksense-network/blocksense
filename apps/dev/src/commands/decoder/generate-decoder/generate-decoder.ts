import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

import { Effect } from 'effect';
import { Command, Options } from '@effect/cli';
import chalk from 'chalk';

import { rootDir } from '@blocksense/base-utils';
import { expandJsonFields } from '@blocksense/decoders/expand-wit-json';
import { generateDecoders } from '@blocksense/decoders/generate-decoders';

const execPromise = promisify(exec);

export const generateDecoder = Command.make(
  'generate-decoder',
  {
    decoderType: Options.choice('decoder-type', ['ssz', 'encode-packed']).pipe(
      Options.withDefault('ssz'),
    ),
    evmVersion: Options.choice('evm-version', ['cancun', 'legacy']).pipe(
      Options.withDefault('cancun'),
    ),
    witPath: Options.file('wit-path').pipe(
      Options.withDefault('libs/sdk/wit/blocksense-oracle.wit'),
    ),
    witWorld: Options.text('wit-world').pipe(
      Options.withDefault('blocksense-oracle'),
    ),
    witFunction: Options.text('wit-function').pipe(
      Options.withDefault('handle-oracle-request'),
    ),
    outputDir: Options.directory('output-dir').pipe(
      Options.withDefault('generated-decoders'),
    ),
  },
  ({ decoderType, evmVersion, outputDir, witFunction, witPath, witWorld }) =>
    Effect.gen(function* () {
      const witFilePath = path.join(rootDir, witPath);
      if (!(yield* Effect.tryPromise(() => fs.stat(witFilePath)))) {
        return yield* Effect.fail(`WIT file not found at path: ${witFilePath}`);
      }

      const args = [
        '--input',
        path.join(rootDir, witPath),
        '--world',
        witWorld,
        '--function',
        witFunction,
      ];
      const res = yield* Effect.tryPromise(() =>
        execPromise(`wit-converter ${args.join(' ')}`, {
          cwd: path.join(rootDir, 'apps/wit-converter'),
        }),
      );

      const witJson = JSON.parse(res.stdout);
      const containsUnion = Object.values(witJson.types).some(
        (field: any) => field.type === 'union',
      );
      if (containsUnion && decoderType === 'encode-packed') {
        return yield* Effect.fail(
          'Encode-packed decoder does not support union types.',
        );
      }

      const fields = expandJsonFields(witJson.payloadTypeName, witJson.types);

      const outputPath = path.join(rootDir, outputDir);
      yield* Effect.tryPromise(() => fs.mkdir(outputPath, { recursive: true }));

      const contractPaths = yield* Effect.tryPromise(() =>
        generateDecoders(
          decoderType,
          evmVersion,
          outputPath,
          fields[witJson.payloadTypeName],
          { containsUnion },
        ),
      );

      // Print out the generated decoder file paths
      const header = `| ${'Decoder File'.padEnd(25)} | ${'Path'.padEnd(50)} |`;
      const separator = `|${'-'.repeat(27)}|${'-'.repeat(52)}|`;
      const rows = contractPaths.map((filePath: string) => {
        const name = chalk.green(path.basename(filePath).padEnd(25));
        const fullPath = `${chalk.magenta('$ROOT')}${chalk.blue(
          filePath.replace(rootDir, '').padEnd(45),
        )}`;
        return `| ${name} | ${fullPath} |`;
      });

      console.log(chalk.yellow('\nGenerated Decoder Files:'));
      console.log(`$ROOT=${chalk.magenta(rootDir)}\n`);
      const tableOutput = [header, separator, ...rows].join('\n');
      console.log(tableOutput);

      return contractPaths;
    }),
);
