import { Effect, ParseResult, Schema as S } from 'effect';
import { Command } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';

import { arrayToObject } from '@blocksense/base-utils/array-iter';
import { rootDir } from '@blocksense/base-utils/env';
import type { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { readConfig, readEvmDeployment } from '@blocksense/config-types';

import { logMessage } from '../../utils/logs';
import type { FeedsValueAndRound } from '../../utils/onchain';
import { getDataFeedsInfoFromNetwork } from '../../utils/onchain';
import { RGLogCheckerError } from '../../utils/types';

const E2E_TESTS_FEEDS_CONFIG_DIR = `${rootDir}/apps/e2e-tests/src/test-scenarios/general`;

// TODO: (danielstoyanov) The following functions will be moved to utils package
// and the new ProcessComposeManager (implementation of EnvironmentManager abstraction)

const ProcessComposeStatusSchema = S.mutable(
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

export function startEnvironment(
  testEnvironment: string,
): Effect.Effect<void, Error> {
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

export function stopEnvironment(): Effect.Effect<void, Error> {
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

export function logTestEnvironmentInfo(
  status: 'Starting' | 'Stopping',
  name?: string,
): Effect.Effect<void> {
  return Effect.sync(() => {
    const time = new Date();
    logMessage(
      'info',
      `${status} test environment${name ? `: ${name}` : ''}...`,
      `${status} time: ${time.toDateString()} ${time.toTimeString()}`,
    );
  });
}

export const rgSearchPattern = ({
  caseInsensitive = true,
  file,
  flags = [],
  pattern,
}: {
  caseInsensitive?: boolean;
  file: string;
  flags?: string[];
  pattern: string;
}): Effect.Effect<boolean, RGLogCheckerError> => {
  const args = caseInsensitive
    ? ['--quiet', '-i', ...flags, pattern, file]
    : ['--quiet', ...flags, pattern, file];

  return Command.make('rg', ...args).pipe(
    Command.exitCode,
    Effect.matchEffect({
      onFailure: commandError =>
        Effect.fail(new RGLogCheckerError({ cause: commandError })),
      onSuccess: exitCode => {
        if (exitCode === 0) {
          return Effect.succeed(true);
        }
        if (exitCode === 1) {
          return Effect.succeed(false);
        }
        return Effect.fail(
          new RGLogCheckerError({
            cause: `ripgrep process error: exited with code ${exitCode}`,
          }),
        );
      },
    }),
    Effect.provide(NodeContext.layer),
  );
};

export function getInitialFeedsInfoFromNetwork(
  network: NetworkName,
): Effect.Effect<
  {
    feedIds: bigint[];
    address: EthereumAddress;
    initialFeedsInfo: FeedsValueAndRound;
  },
  Error,
  never
> {
  return Effect.gen(function* () {
    const feedConfig = yield* Effect.tryPromise(() =>
      readConfig('feeds_config_v2', E2E_TESTS_FEEDS_CONFIG_DIR),
    );
    const feedIds = feedConfig.feeds.map(feed => BigInt(feed.id));

    const deploymentConfig = yield* Effect.tryPromise(() =>
      readEvmDeployment(network, true),
    );
    const { address } =
      deploymentConfig.contracts.coreContracts.UpgradeableProxyADFS;

    const initialFeedsInfo = yield* getDataFeedsInfoFromNetwork(
      feedIds,
      address,
      'ink-sepolia',
    );

    return { feedIds, address, initialFeedsInfo };
  });
}
