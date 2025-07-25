import { Effect, ParseResult, Schema as S } from 'effect';
import { $, execa } from 'execa';

import { logMessage } from '../utils/logs';

import { arrayToObject } from '@blocksense/base-utils/array-iter';
import { rootDir } from '@blocksense/base-utils/env';
import { getMetrics } from '../utils/metrics/metrics-fetcher';
import type { UpdatesToNetwork } from './types';
import { UpdatesToNetworkMetric } from './types';

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
  await execa('just', ['start-environment', testEnvironment, '--detached'], {
    env: {
      FEEDS_CONFIG_DIR: `${rootDir}/apps/e2e-tests/src/process-compose/config`,
    },
  });
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
    `${status} test environment ${name}`,
    `${status} time: ${time.toDateString()} ${time.toTimeString()}`,
  );
}

export function fetchUpdatesToNetworksMetric() {
  return Effect.gen(function* () {
    const metrics = yield* getMetrics('http://127.0.0.1:5551/metrics');
    const updatesToNetworks = metrics.filter(
      metric => metric.name === 'updates_to_networks',
    )[0];
    if (!updatesToNetworks) return null;

    const decoded = S.decodeUnknownSync(UpdatesToNetworkMetric)(
      updatesToNetworks,
    );
    return decoded.metrics.reduce((acc: UpdatesToNetwork, item) => {
      const networkName = item.labels.Network;
      const feedId = item.labels.FeedId;
      const value = item.value;

      if (!acc[networkName]) {
        acc[networkName] = {};
      }

      acc[networkName][feedId] = value;

      return acc;
    }, {} as UpdatesToNetwork);
  });
}
