import path from 'path';

import { Clock, Context, Data, Effect, Layer, Schema as S } from 'effect';
import type { ParseError } from 'effect/ParseResult';
import { FetchHttpClient, HttpClientRequest } from '@effect/platform';
import { HttpClient, post } from '@effect/platform/HttpClient';
import type { HttpClientError } from '@effect/platform/HttpClientError';
import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import { NodeHttpClient } from '@effect/platform-node';

import { rootDir, selectDirectory, skip0x } from '@blocksense/base-utils';
import { fetchAndDecodeJSONEffect } from '@blocksense/base-utils/http';
import type { NewFeedsConfig } from '@blocksense/config-types';
import { NewFeedsConfigSchema } from '@blocksense/config-types';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';
import { SequencerConfigV2Schema } from '@blocksense/config-types/node-config';

import { type FeedResult,generateSignature } from './generate-signature';
import { getMetrics,ParseMetricsError } from './metrics';

export class EnvironmentManager extends Context.Tag(
  '@e2e-tests/EnvironmentManager',
)<
  EnvironmentManager,
  {
    readonly start: (
      environmentName: string,
    ) => Effect.Effect<void, EnvironmentError, never>;
    readonly stop: () => Effect.Effect<void, EnvironmentError, never>;
    readonly getProcessesStatus: () => Effect.Effect<
      ProcessStatuses,
      EnvironmentError,
      never
    >;
  }
>() {}

export type EnvironmentManagerService = Context.Tag.Service<EnvironmentManager>;

export class EnvironmentError extends Data.TaggedError(
  '@e2e-tests/EnvironmentError',
)<{
  readonly message: string;
}> {}

export type ProcessStatus = Readonly<{
  status: string;
  exit_code: number;
}>;

export type ProcessStatuses = Readonly<Record<string, ProcessStatus>>;

export class Sequencer extends Context.Tag('@e2e-tests/Sequencer')<
  Sequencer,
  {
    readonly configUrl: string;
    readonly feedsConfigUrl: string;
    readonly metricsUrl: string;
    readonly postReportsBatchUrl: string;
    readonly reporterKey: string;
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
    readonly postReportsBatch: (
      reports: ReportData[],
    ) => Effect.Effect<HttpClientResponse, HttpClientError | Error, never>;
    readonly enableProvider: (
      provider: string,
    ) => Effect.Effect<HttpClientResponse, HttpClientError, never>;
  }
>() {
  static Live = Layer.effect(
    Sequencer,
    Effect.gen(function* () {
      const mainPort = 9856;
      const adminPort = 5553;
      const metricsPort = 5551;
      const localhost = 'http://127.0.0.1';

      const configUrl = yield* Effect.succeed(
        `${localhost}:${adminPort}/get_sequencer_config`,
      );
      const feedsConfigUrl = yield* Effect.succeed(
        `${localhost}:${adminPort}/get_feeds_config`,
      );
      const metricsUrl = yield* Effect.succeed(
        `${localhost}:${metricsPort}/metrics`,
      );
      const historyUrl = yield* Effect.succeed(
        `${localhost}:${adminPort}/get_history`,
      );
      const postReportsBatchUrl = yield* Effect.succeed(
        `${localhost}:${mainPort}/post_reports_batch`,
      );
      const reporterKey = yield* Effect.tryPromise(() =>
        selectDirectory(
          path.resolve(rootDir, 'nix/test-environments/test-keys'),
        )
          .read({ base: 'reporter_secret_key' })
          .then(s => s.trim()),
      ).pipe(
        Effect.catchAll(err => {
          console.log('error: ', err);
          return Effect.fail(new Error(String(err)));
        }),
      );

      return Sequencer.of({
        configUrl,
        feedsConfigUrl,
        metricsUrl,
        postReportsBatchUrl,
        reporterKey,
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
        postReportsBatch: (reports: ReportData[]) =>
          Effect.gen(function* () {
            const timestamp = yield* Clock.currentTimeMillis;
            const reportsPayload: ReportPayload[] = yield* Effect.forEach(
              reports,
              r =>
                Effect.gen(function* () {
                  const signature = yield* generateSignature(
                    reporterKey,
                    r.feed_id,
                    BigInt(timestamp),
                    r.value,
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
                    result: r.value,
                  };
                }),
            );

            const client = yield* HttpClient;
            const response = HttpClientRequest.post(postReportsBatchUrl).pipe(
              HttpClientRequest.setHeader('Content-Type', 'application/json'),
              HttpClientRequest.bodyText(JSON.stringify(reportsPayload)),
              client.execute,
            );

            return yield* response;
          }).pipe(Effect.provide(NodeHttpClient.layer)),
        enableProvider: (provider: string) => {
          return post(
            `${localhost}:${adminPort}/enable_provider/${provider}`,
          ).pipe(Effect.provide(NodeHttpClient.layer));
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
  value: FeedResult;
};

type ReportPayloadData = {
  feed_id: string;
  reporter_id: number;
  timestamp: number;
  signature: string;
};

export type ReportPayload = {
  payload_metadata: ReportPayloadData;
  result: FeedResult;
};

// TODO: (danielstoyanov) Once we introduce new environment manager(docker/systemd), we have to make this schema generic
export const ProcessComposeStatusSchema = S.mutable(
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
