import { Effect, ParseResult, Schema as S } from 'effect';
import { NodeContext } from '@effect/platform-node';
import { $, execa } from 'execa';

import { logMessage } from '../utils/logs';

import { arrayToObject } from '@blocksense/base-utils/array-iter';
import { rootDir } from '@blocksense/base-utils/env';
import { Command } from '@effect/platform';
import { RGLogCheckerError } from './types';

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

export const rgSearchForPattern = ({
  caseInsensitive = true,
  file,
  flags = [],
  pattern,
}: {
  caseInsensitive?: boolean;
  file: string;
  flags?: Array<string>;
  pattern: string;
}) => {
  const args = ['--quiet'];
  if (caseInsensitive) args.push('-i');
  if (flags) flags.forEach(f => args.push(f));
  args.push(pattern, file);

  return Command.make('rg', ...args)
    .pipe(
      Command.exitCode,
      Effect.catchAll(error => new RGLogCheckerError({ cause: error })),
    )
    .pipe(Effect.provide(NodeContext.layer));
};
