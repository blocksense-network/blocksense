import type { ParseResult } from 'effect';
import { Context, Data, Effect, Layer, Schema as S } from 'effect';

import {
  fetchAndDecodeJSON,
  fetchAndDecodeJSONEffect,
} from '@blocksense/base-utils/http';
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
import type { FeedResult } from './generate-signature';

export class ProcessComposeFailedToStartError extends Data.TaggedError(
  '@e2e-tests/ProcessComposeFailedToStartError',
)<{
  cause: unknown;
}> {}

export class ProcessCompose extends Context.Tag('@e2e-tests/ProcessCompose')<
  ProcessCompose,
  {
    readonly start: (
      name: string,
    ) => Effect.Effect<void, ProcessComposeFailedToStartError, never>;
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
          catch: cause => new ProcessComposeFailedToStartError({ cause }),
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
    readonly postReportsBatchUrl: string;
    readonly reporterKey: string;
    readonly getConfig: () => Effect.Effect<SequencerConfigV2, Error, never>;
    readonly getFeedsConfig: () => Effect.Effect<NewFeedsConfig, Error, never>;
    readonly fetchUpdatesToNetworksMetric: () => Effect.Effect<
      UpdatesToNetwork,
      ParseMetricsError | HttpClientError | ParseResult.ParseError
    >;
    readonly fetchHistory: () => Effect.Effect<
      FeedAggregateHistory,
      Error,
      never
    >;
    readonly postReportsBatch: (
      reports: Array<ReportData>,
    ) => Effect.Effect<HttpClientResponse, HttpClientError | Error, never>;
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
      const postReportsBatchUrl = yield* Effect.succeed(
        'http://127.0.0.1:9856/post_reports_batch',
      );
      const reporterKey = yield* Effect.succeed(
        '536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003',
      );

      return Sequencer.of({
        configUrl,
        feedsConfigUrl,
        metricsUrl,
        postReportsBatchUrl,
        reporterKey,
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
        fetchHistory: () => {
          return Effect.gen(function* () {
            const history = yield* fetchAndDecodeJSONEffect(
              FeedAggregateHistorySchema,
              historyUrl,
            ).pipe(Effect.provide(FetchHttpClient.layer));
            return history;
          });
        },
        postReportsBatch: (reports: Array<ReportData>) =>
          Effect.gen(function* () {
            const timestamp = yield* Clock.currentTimeMillis;
            const reportsPayload: Array<ReportPayload> = yield* Effect.forEach(
              reports,
              r =>
                Effect.gen(function* () {
                  const signature = yield* generateSignature(
                    reporterKey,
                    r.feed_id,
                    BigInt(timestamp),
                    { Ok: { Numerical: r.value } },
                  ).pipe(
                    Effect.mapError(
                      err => new Error(`Failed to generate signature: ${err}`),
                    ),
                  );

                  return {
                    payload_metadata: {
                      feed_id: r.feed_id,
                      reporter_id: 0,
                      signature: skip0x(signature),
                      timestamp,
                    },
                    result: {
                      Ok: {
                        Numerical: r.value,
                      },
                    },
                  };
                }),
            );

            const client = yield* HttpClient;
            const response = HttpClientRequest.post(postReportsBatchUrl).pipe(
              HttpClientRequest.bodyText(
                JSON.stringify(reportsPayload),
                'application/json; charset=UTF-8',
              ),
              client.execute,
            );

            return yield* response;
          }).pipe(Effect.provide(NodeHttpClient.layer)),
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

export type ReportData = {
  feed_id: string;
  value: number;
};

type ReportPayloadData = {
  feed_id: string;
  reporter_id: number;
  timestamp: number;
  signature: string;
};

type ReportPayload = {
  payload_metadata: ReportPayloadData;
  result: FeedResult;
};
