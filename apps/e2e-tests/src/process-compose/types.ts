import type { ParseResult } from 'effect';
import { Context, Data, Effect, Layer, Schema as S } from 'effect';

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
import type { HttpClientError } from '@effect/platform/HttpClientError';
import { ParseMetricsError, getMetrics } from '../utils/metrics';
import { FetchHttpClient } from '@effect/platform';

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
>() {
  static Live = Layer.succeed(
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
          catch: error =>
            new Error(`Failed to parse processes status: ${error}`),
        }),
    }),
  );
}

export type ProcessComposeService = Context.Tag.Service<ProcessCompose>;

export class Sequencer extends Context.Tag('@e2e-tests/Sequencer')<
  Sequencer,
  {
    readonly configUrl: string;
    readonly feedsConfigUrl: string;
    readonly metricsUrl: string;
    readonly getConfig: () => Effect.Effect<SequencerConfigV2, Error, never>;
    readonly getFeedsConfig: () => Effect.Effect<NewFeedsConfig, Error, never>;
    readonly fetchUpdatesToNetworksMetric: () => Effect.Effect<
      UpdatesToNetwork,
      ParseMetricsError | HttpClientError | ParseResult.ParseError
    >;
  }
>() {
  static Live = Layer.effect(
    Sequencer,
    Effect.gen(function* () {
      const configUrl = yield* Effect.succeed(
        'http://127.0.0.1:5553/get_sequencer_config',
      );
      const feedsConfigUrl = yield* Effect.succeed(
        'http://127.0.0.1:5553/get_feeds_config',
      );
      const metricsUrl = yield* Effect.succeed('http://127.0.0.1:5551/metrics');

      return Sequencer.of({
        configUrl,
        feedsConfigUrl,
        metricsUrl,
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
        fetchUpdatesToNetworksMetric: () => {
          return Effect.gen(function* () {
            const metrics = yield* getMetrics(metricsUrl).pipe(
              Effect.provide(FetchHttpClient.layer),
            );
            const updatesToNetworks = metrics.filter(
              metric => metric.name === 'updates_to_networks',
            )[0];

            if (!updatesToNetworks) {
              return yield* Effect.fail(
                new ParseMetricsError({
                  message: `No 'updates_to_networks' metric found in the response from ${metricsUrl}`,
                }),
              );
            }

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
        },
      });
    }),
  );
}

export type SequencerService = Context.Tag.Service<Sequencer>;

export class RGLogCheckerError extends Data.TaggedError(
  '@e2e-tests/RGLogCheckerError',
)<{
  cause: unknown;
}> {}

// TODO: (danielstoyanov) Define custom error types for Services and Layers
// class ExampleError extends Data.TaggedError('@e2e-tests/ExampleError')<{
//   readonly message: string;
// }> {}

export const UpdatesToNetworkMetric = S.Struct({
  name: S.Literal('updates_to_networks'),
  type: S.Literal('COUNTER'),
  metrics: S.Array(
    S.Struct({
      value: S.Number,
      labels: S.Struct({
        Network: S.String,
        FeedId: S.String,
      }),
    }),
  ),
});

export type UpdatesToNetwork = Record<string, Record<string, number>>;
