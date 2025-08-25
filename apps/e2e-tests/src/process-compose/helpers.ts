import { Effect, ParseResult, Schema as S } from 'effect';
import { NodeContext } from '@effect/platform-node';
import { Command } from '@effect/platform';
import { $, execa } from 'execa';

import { arrayToObject } from '@blocksense/base-utils/array-iter';
import { rootDir } from '@blocksense/base-utils/env';
import type { NetworkName } from '@blocksense/base-utils/evm/networks';
import { readConfig, readEvmDeployment } from '@blocksense/config-types';

import { RGLogCheckerError } from './types';
import { logMessage } from '../utils/logs';
import type { FeedsValueAndRound } from '../utils/onchain';
import { getDataFeedsInfoFromNetwork } from '../utils/onchain';

const E2E_TESTS_FEEDS_CONFIG_DIR = `${rootDir}/apps/e2e-tests/src/process-compose/config`;

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

export async function parseProcessesStatus() {
  const { stdout } = await $`process-compose process list -o json`;
  return arrayToObject(
    ParseResult.decodeUnknownSync(ProcessComposeStatusSchema)(
      JSON.parse(stdout),
    ),
    'name',
  );
}

export async function startEnvironment(testEnvironment: string): Promise<void> {
  logTestEnvironmentInfo('Starting', testEnvironment);
  await execa(
    'just',
    ['start-environment', testEnvironment, '0', '--detached'],
    {
      env: {
        FEEDS_CONFIG_DIR: `${E2E_TESTS_FEEDS_CONFIG_DIR}`,
      },
    },
  );
}

export async function stopEnvironment(): Promise<void> {
  logTestEnvironmentInfo('Stopping');
  await $`just stop-environment`;
}

export function logTestEnvironmentInfo(
  status: 'Starting' | 'Stopping',
  name?: string,
): void {
  const time = new Date();
  logMessage(
    'info',
    `${status} test environment${name ? `: ${name}` : ''}...`,
    `${status} time: ${time.toDateString()} ${time.toTimeString()}`,
  );
}

export const rgSearchPattern = ({
  caseInsensitive = true,
  file,
  flags = [],
  pattern,
}: {
  caseInsensitive?: boolean;
  file: string;
  flags?: Array<string>;
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
    feedIds: Array<bigint>;
    address: `0x${string}`;
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
      readEvmDeployment(network),
    );
    const address = deploymentConfig?.contracts.coreContracts
      .UpgradeableProxyADFS.address as `0x${string}`;

    const initialFeedsInfo = yield* getDataFeedsInfoFromNetwork(
      feedIds,
      address,
      'ink-sepolia',
    );

    return { feedIds, address, initialFeedsInfo };
  });
}
