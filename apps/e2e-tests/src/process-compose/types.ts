import { Context, Data, Effect, Layer } from 'effect';
import { execa } from 'execa';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import {
  startEnvironment,
  stopEnvironment,
  parseProcessesStatus,
} from './helpers';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';
import { SequencerConfigV2Schema } from '@blocksense/config-types/node-config';
import type { NewFeedsConfig } from '@blocksense/config-types';
import { NewFeedsConfigSchema } from '@blocksense/config-types';

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

export type ProcessComposeService = Context.Tag.Service<ProcessCompose>;

export class Sequencer extends Context.Tag('@e2e-tests/Sequencer')<
  Sequencer,
  {
    readonly configUrl: string;
    readonly feedsConfigUrl: string;
    readonly getConfig: () => Effect.Effect<SequencerConfigV2, Error, never>;
    readonly getFeedsConfig: () => Effect.Effect<NewFeedsConfig, Error, never>;
  }
>() {}

export class RGLogChecker extends Context.Tag('@e2e-tests/RGLogChecker')<
  RGLogChecker,
  {
    readonly assertDoesNotContain: (args: {
      readonly file: string;
      readonly pattern: string;
      readonly caseInsensitive?: boolean;
      readonly flags?: Array<string>;
    }) => Effect.Effect<void, RGLogCheckerError>;
  }
>() {}

export class RGLogCheckerError extends Data.TaggedError(
  '@e2e-tests/RGLogCheckerError',
)<{
  cause: unknown;
}> {}

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

export const SequencerLive = Layer.effect(
  Sequencer,
  Effect.gen(function* () {
    const configUrl = yield* Effect.succeed(
      'http://127.0.0.1:5553/get_sequencer_config',
    );
    const feedsConfigUrl = yield* Effect.succeed(
      'http://127.0.0.1:5553/get_feeds_config',
    );

    return Sequencer.of({
      configUrl,
      feedsConfigUrl,
      getConfig: () =>
        Effect.tryPromise({
          try: () => fetchAndDecodeJSON(SequencerConfigV2Schema, configUrl),
          catch: error =>
            new Error(`Failed to fetch sequencer config: ${error}`),
        }),
      getFeedsConfig: () =>
        Effect.tryPromise({
          try: () => fetchAndDecodeJSON(NewFeedsConfigSchema, feedsConfigUrl),
          catch: error => new Error(`Failed to fetch feeds config: ${error}`),
        }),
    });
  }),
);

export const RGLogCheckerLive = Layer.succeed(
  RGLogChecker,
  RGLogChecker.of({
    assertDoesNotContain: ({ caseInsensitive, file, flags, pattern }) =>
      Effect.tryPromise({
        try: () => {
          const args = ['--quiet'];
          if (caseInsensitive) args.push('-i');
          if (flags) flags.forEach(f => args.push(f));
          args.push(pattern, file);

          return execa('rg', args, { reject: false });
        },
        catch: unknown => new RGLogCheckerError({ cause: unknown }),
      }).pipe(Effect.map(result => result.exitCode)),
  }),
);

// TODO: (danielstoyanov) Define custom error types for Services and Layers
// class ExampleError extends Data.TaggedError('@e2e-tests/ExampleError')<{
//   readonly message: string;
// }> {}
