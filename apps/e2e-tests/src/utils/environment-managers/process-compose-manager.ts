import { Effect,Layer } from 'effect';
import { Command } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';

import { EnvironmentError,EnvironmentManager } from '../types';
import {
  E2E_TESTS_FEEDS_CONFIG_DIR,
  logTestEnvironmentInfo,
  parseProcessesStatus,
} from '../utilities';

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

function startEnvironment(testEnvironment: string): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    yield* logTestEnvironmentInfo('Starting', testEnvironment);
    yield* Effect.sync(() => {
      process.env['FEEDS_CONFIG_DIR'] = E2E_TESTS_FEEDS_CONFIG_DIR;
    });
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
