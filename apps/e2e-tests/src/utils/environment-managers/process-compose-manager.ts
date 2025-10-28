import { Effect, Layer, ParseResult, Schema as S } from 'effect';
import { Command, FileSystem } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';

import { arrayToObject } from '@blocksense/base-utils/array-iter';
import { rootDir } from '@blocksense/base-utils/env';

import { logTestEnvironmentInfo } from '../utilities';

import { EnvironmentError, EnvironmentManager } from './types';

export const GENERAL_SCENARIO_FEEDS_CONFIG_DIR = `${rootDir}/apps/e2e-tests/src/test-scenarios/general`;
export function getFeedsConfigForScenario(scenario: string) {
  return Effect.gen(function* () {
    const configDir = `${rootDir}/apps/e2e-tests/src/test-scenarios/${scenario}`;
    const exists = yield* FileSystem.FileSystem.pipe(
      Effect.flatMap(fs => fs.exists(configDir)),
      Effect.provide(NodeContext.layer),
    );

    return exists ? configDir : GENERAL_SCENARIO_FEEDS_CONFIG_DIR;
  });
}
// export function getFeedsConfigForScenario(scenario: string): Effect.Effect<string, never, never> {
//   const scenarioFeedsConfigDir = `${rootDir}/apps/e2e-tests/src/test-${scenario}/general`;
//
//   return Effect.gen(function*() {
//     let stat = yield* Effect.tryPromise(() => fs.stat(scenarioFeedsConfigDir)).pipe(
//       Effect.match({
//         onSuccess: () => true,
//         onFailure: () => false
//       }));
//     return stat ? scenarioFeedsConfigDir : GENERAL_SCENARIO_FEEDS_CONFIG_DIR;
//   });
// }

export const ProcessComposeLive = Layer.succeed(
  EnvironmentManager,
  EnvironmentManager.of({
    start: (environmentName: string) =>
      startEnvironment(environmentName).pipe(
        Effect.mapError(
          error =>
            new EnvironmentError({
              message: `Failed to start environment "${environmentName}": ${String(error)}`,
            }),
        ),
      ),
    stop: () =>
      stopEnvironment().pipe(
        Effect.mapError(
          error =>
            new EnvironmentError({
              message: `Failed to stop environment: ${String(error)}`,
            }),
        ),
      ),
    getProcessesStatus: () =>
      parseProcessesStatus().pipe(
        Effect.mapError(
          error =>
            new EnvironmentError({
              message: `Failed to parse processes status: ${String(error)}`,
            }),
        ),
      ),
  }),
);

function startEnvironment(testScenario: string): Effect.Effect<void, Error> {
  // NOTE: as per <../../../../../nix/test-environments/default.nix:39>
  let testEnvironment = `e2e-${testScenario}`;

  return Effect.gen(function*() {
    yield* logTestEnvironmentInfo('Starting', testEnvironment);

    process.env['FEEDS_CONFIG_DIR'] = yield* getFeedsConfigForScenario(testScenario);

    const command = Command.make(
      'just',
      'start-environment',
      testEnvironment,
      '0',
      '--detached',
    );

    const exitCode = yield* command.pipe(
      Command.exitCode,
      Effect.provide(NodeContext.layer),
    );

    if (exitCode !== 0) {
      return yield* Effect.fail(
        new Error(`Command failed with exit code ${exitCode}`),
      );
    }
  });
}

function stopEnvironment(): Effect.Effect<void, Error> {
  return Effect.gen(function*() {
    yield* logTestEnvironmentInfo('Stopping');
    const command = Command.make('just', 'stop-environment');
    const exitCode = yield* command.pipe(
      Command.exitCode,
      Effect.provide(NodeContext.layer),
    );
    if (exitCode !== 0) {
      return yield* Effect.fail(
        new Error(`Command failed with exit code ${exitCode}`),
      );
    }
  });
}

export const ProcessComposeStatusSchema = S.mutable(
  S.Array(
    // The fields below are commented out because they are not used in the current implementation
    // but are kept for future reference or potential use.
    S.Struct({
      name: S.String,
      // namespace: S.String,
      status: S.Literal('Running', 'Completed', 'Pending'),
      // system_time: S.String,
      // age: S.Number,
      // is_ready: S.String,
      // restarts: S.Number,
      exit_code: S.Number,
      // pid: S.Number,
      // is_elevated: S.Boolean,
      // password_provided: S.Boolean,
      // mem: S.Number,
      // cpu: S.Number,
      // IsRunning: S.Boolean,
    }),
  ),
);

export function parseProcessesStatus(): Effect.Effect<
  Record<string, (typeof ProcessComposeStatusSchema.Type)[number]>,
  Error
> {
  return Effect.gen(function*() {
    const command = Command.make(
      'process-compose',
      'process',
      'list',
      '-o',
      'json',
    );
    const result = yield* command.pipe(
      Command.string,
      Effect.provide(NodeContext.layer),
    );
    return arrayToObject(
      ParseResult.decodeUnknownSync(ProcessComposeStatusSchema)(
        JSON.parse(result),
      ),
      'name',
    );
  });
}
