import {
  Effect,
  Layer,
  ParseResult,
  pipe,
  Schema as S,
  Stream,
  String as EString,
} from 'effect';
import { Command } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';

import { arrayToObject } from '@blocksense/base-utils/array-iter';
import { rootDir } from '@blocksense/base-utils/env';

import { logTestEnvironmentInfo } from '../utilities';

import { EnvironmentError, EnvironmentManager } from './types';

export const GENERAL_SCENARIO_FEEDS_CONFIG_DIR = `${rootDir}/apps/e2e-tests/src/test-scenarios/general`;

export const ProcessComposeLive = Layer.succeed(
  EnvironmentManager,
  EnvironmentManager.of({
    start: (environmentName: string) =>
      pipe(
        Effect.gen(function* () {
          yield* validateEnv();
          yield* startEnvironment(environmentName);
        }),
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

function startEnvironment(testEnvironment: string): Effect.Effect<void, Error> {
  const runString = <E, R>(
    stream: Stream.Stream<Uint8Array, E, R>,
  ): Effect.Effect<string, E, R> =>
    stream.pipe(
      Stream.decodeText(),
      Stream.runFold(EString.empty, EString.concat),
    );

  return Effect.gen(function* () {
    yield* logTestEnvironmentInfo('Starting', testEnvironment);
    yield* Effect.sync(() => {
      process.env['FEEDS_CONFIG_DIR'] = GENERAL_SCENARIO_FEEDS_CONFIG_DIR;
    });
    const program = Effect.gen(function* () {
      const command = Command.make(
        'just',
        'start-environment',
        'e2e-general',
        '0',
        '--detached',
      );
      const [exitCode, stderr] = yield* pipe(
        Command.start(command),
        Effect.flatMap(process =>
          Effect.all([process.exitCode, runString(process.stderr)], {
            concurrency: 3,
          }),
        ),
      );
      if (exitCode !== 0) {
        return yield* Effect.fail(
          new Error(
            `Command failed with exit code ${exitCode}. Error: ${stderr}`,
          ),
        );
      }
    });

    yield* Effect.scoped(program).pipe(Effect.provide(NodeContext.layer));
  });
}

function stopEnvironment(): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
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
  return Effect.gen(function* () {
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

function validateEnv(): Effect.Effect<void, EnvironmentError> {
  const requiredEnvVars = ['RPC_URL_INK_SEPOLIA', 'RPC_URL_ETHEREUM_SEPOLIA'];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

  return missingEnvVars.length > 0
    ? Effect.fail(
        new EnvironmentError({
          message:
            'Missing required environment variables: ' +
            missingEnvVars.join(', '),
        }),
      )
    : Effect.void;
}
