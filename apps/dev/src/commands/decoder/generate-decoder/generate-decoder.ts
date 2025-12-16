import path from 'path';

import { Effect } from 'effect';
import { Command, Options } from '@effect/cli';
import { Command as Exec } from '@effect/platform';
import * as FileSystem from '@effect/platform/FileSystem';
import chalk from 'chalk';

import { rootDir, valuesOf } from '@blocksense/base-utils';
import { expandJsonFields } from '@blocksense/decoders/expand-wit-json';
import { generateDecoders } from '@blocksense/decoders/generate-decoders';

export const generateDecoder = Command.make(
  'generate-decoder',
  {
    stride: Options.integer('stride').pipe(Options.withDefault(0)),
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
  ({
    decoderType,
    evmVersion,
    outputDir,
    stride,
    witFunction,
    witPath,
    witWorld,
  }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const witFilePath = path.join(rootDir, witPath);
      if (!(yield* fs.stat(witFilePath))) {
        return yield* Effect.fail(`WIT file not found at path: ${witFilePath}`);
      }

      // Generate temporary JSON representation from WIT file
      const tempOutputPath = path.join(rootDir, 'tmp/wit-output.json');

      yield* fs.makeDirectory(path.dirname(tempOutputPath), {
        recursive: true,
      });

      const args = [
        '--input',
        path.join(rootDir, witPath),
        '--output',
        tempOutputPath,
        '--world',
        witWorld,
        '--function',
        witFunction,
      ];

      yield* Exec.make('wit-converter', ...args).pipe(
        Exec.workingDirectory(path.join(rootDir, 'apps/wit-converter')),
        Exec.string,
      );

      const witJson = yield* fs.readFileString(tempOutputPath).pipe(
        Effect.map(json => JSON.parse(json)),
        // Clean up temporary file
        Effect.ensuring(fs.remove(tempOutputPath).pipe(Effect.ignore)),
      );

      const containsUnion = valuesOf(witJson.types).some(
        (field: any) => field.type === 'union',
      );
      if (containsUnion && decoderType === 'encode-packed') {
        return yield* Effect.fail(
          'Encode-packed decoder does not support union types.',
        );
      }

      const fields = expandJsonFields(witJson.payloadTypeName, witJson.types);

      const outputPath = path.join(rootDir, outputDir);
      yield* fs.makeDirectory(outputPath, { recursive: true });

      const contractPaths = yield* Effect.tryPromise(() =>
        generateDecoders(
          decoderType,
          evmVersion,
          outputPath,
          fields[witJson.payloadTypeName],
          { containsUnion, stride },
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
