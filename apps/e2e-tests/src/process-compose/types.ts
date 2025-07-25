import { Context, Data, Effect, Layer } from 'effect';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import {
  startEnvironment,
  stopEnvironment,
  parseProcessesStatus,
} from './helpers';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';
import { SequencerConfigV2Schema } from '@blocksense/config-types/node-config';
import { execa } from 'execa';

// --- Services Definition ---
export class ProcessCompose extends Context.Tag('@e2e-tests/ProcessCompose')<
  ProcessCompose,
  {
    readonly start: (name: string) => Effect.Effect<void, Error, never>;
    readonly stop: () => Effect.Effect<void, Error, never>;
    readonly parseStatus: () => Effect.Effect<
      Record<string, { status: string; exit_code: number }>,
      Error,
      never
    >;
  }
>() {}

export class Sequencer extends Context.Tag('@e2e-tests/Sequencer')<
  Sequencer,
  {
    readonly getConfig: (
      url: string,
    ) => Effect.Effect<SequencerConfigV2, Error, never>;
  }
>() {}

export class LogChecker extends Context.Tag('@e2e-tests/Sequencer')<
  LogChecker,
  {
    readonly assertDoesNotContain: (args: {
      readonly file: string;
      readonly pattern: string;
      readonly caseInsensitive?: boolean;
      readonly pcre2?: boolean;
    }) => Effect.Effect<void, LogCheckerError>;
  }
>() {}

// --- Layers Definition ---
export const ProcessComposeLive = Layer.succeed(
  ProcessCompose,
  ProcessCompose.of({
    start: (env: string = 'example-setup-03') =>
      Effect.tryPromise({
        try: () => startEnvironment(env),
        catch: error => new Error(`Failed to start environment: ${error}`),
      }),
    stop: () =>
      Effect.tryPromise({
        try: () => stopEnvironment(),
        catch: error => new Error(`Failed to stop environment: ${error}`),
      }),
    parseStatus: () =>
      Effect.tryPromise({
        try: () => parseProcessesStatus(),
        catch: error => new Error(`Failed to parse processes status: ${error}`),
      }),
  }),
);

export const SequencerLive = Layer.succeed(
  Sequencer,
  Sequencer.of({
    getConfig: url =>
      Effect.tryPromise({
        try: () => fetchAndDecodeJSON(SequencerConfigV2Schema, url),
        catch: error => new Error(`Failed to fetch sequencer config: ${error}`),
      }),
  }),
);

export class LogCheckerError extends Data.TaggedError('LogCheckerError')<{
  cause: unknown;
}> {}

export const LogCheckerLive = Layer.succeed(
  LogChecker,
  LogChecker.of({
    assertDoesNotContain: ({ caseInsensitive, file, pattern, pcre2 }) =>
      Effect.tryPromise({
        try: () => {
          const args = ['--quiet'];
          if (caseInsensitive) args.push('-i');
          if (pcre2) args.push('--pcre2');
          args.push(pattern, file);

          return execa('rg', args, { reject: false });
        },
        catch: unknown => new LogCheckerError({ cause: unknown }),
      }).pipe(Effect.map(result => result.exitCode)),
  }),
);

// TODO: (danielstoyanov) Define custom error types for Services and Layers
// class ExampleError extends Data.TaggedError('@e2e-tests/ExampleError')<{
//   readonly message: string;
// }> {}
