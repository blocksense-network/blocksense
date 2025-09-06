import { Context, Data, Effect, Layer, Schema as S } from 'effect';

import { fetchAndDecodeJSONEffect } from '@blocksense/base-utils/http';
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
import type { ParseError } from 'effect/ParseResult';

export class ProcessCompose extends Context.Tag('@e2e-tests/ProcessCompose')<
  ProcessCompose,
  {
    readonly start: (
      name: string,
    ) => Effect.Effect<void, ProcessComposeError, never>;
    readonly stop: () => Effect.Effect<void, ProcessComposeError, never>;
    readonly parseStatus: () => Effect.Effect<
      Record<string, { status: string; exit_code: number }>,
      ProcessComposeError,
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
          catch: error =>
            new ProcessComposeError({
              message: `Failed to start environment: ${error}`,
            }),
        }),
      stop: () =>
        Effect.tryPromise({
          try: () => stopEnvironment(),
          catch: error =>
            new ProcessComposeError({
              message: `Failed to stop environment: ${error}`,
            }),
        }),
      parseStatus: () =>
        Effect.tryPromise({
          try: () => parseProcessesStatus(),
          catch: error =>
            new ProcessComposeError({
              message: `Failed to parse processes status: ${error}`,
            }),
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
    readonly getConfig: () => Effect.Effect<
      SequencerConfigV2,
      HttpClientError | ParseError,
      never
    >;
    readonly getFeedsConfig: () => Effect.Effect<
      NewFeedsConfig,
      HttpClientError | ParseError,
      never
    >;
    readonly fetchUpdatesToNetworksMetric: () => Effect.Effect<
      UpdatesToNetwork,
      ParseMetricsError | HttpClientError | ParseError
    >;
    readonly fetchHistory: () => Effect.Effect<
      FeedAggregateHistory,
      HttpClientError | ParseError,
      never
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
      const historyUrl = yield* Effect.succeed(
        'http://127.0.0.1:5553/get_history',
      );

      return Sequencer.of({
        configUrl,
        feedsConfigUrl,
        metricsUrl,
        getConfig: () =>
          Effect.gen(function* () {
            return yield* fetchAndDecodeJSONEffect(
              SequencerConfigV2Schema,
              configUrl,
            ).pipe(Effect.provide(FetchHttpClient.layer));
          }),
        getFeedsConfig: () =>
          Effect.gen(function* () {
            return yield* fetchAndDecodeJSONEffect(
              NewFeedsConfigSchema,
              feedsConfigUrl,
            ).pipe(Effect.provide(FetchHttpClient.layer));
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
        fetchHistory: () => {
          return Effect.gen(function* () {
            const history = yield* fetchAndDecodeJSONEffect(
              FeedAggregateHistorySchema,
              historyUrl,
            ).pipe(Effect.provide(FetchHttpClient.layer));
            return history;
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

export class ProcessComposeError extends Data.TaggedError(
  '@e2e-tests/ProcessComposeError',
)<{
  readonly message: string;
}> {}

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

const Numerical = S.Struct({
  Numerical: S.Number,
});

export const FeedAggregateHistorySchema = S.Struct({
  aggregate_history: S.Record({
    key: S.String,
    value: S.Array(
      S.Struct({
        value: Numerical,
        update_number: S.Number,
        end_slot_timestamp: S.Number,
      }),
    ),
  }),
});

export type FeedAggregateHistory = typeof FeedAggregateHistorySchema.Type;
