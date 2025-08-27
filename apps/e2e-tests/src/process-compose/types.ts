import { Clock, Context, Data, Effect, Layer, Schema as S } from 'effect';

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
import { FetchHttpClient, HttpClientRequest } from '@effect/platform';
import { HttpClient } from '@effect/platform/HttpClient';
import { generateSignature, type FeedResult } from './generate-signature';
import type { ParseError } from 'effect/ParseResult';
import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import { rootDir, selectDirectory, skip0x } from '@blocksense/base-utils';
import { NodeHttpClient } from '@effect/platform-node';
import path from 'path';

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
      reports: Array<ReportData>,
    ) => Effect.Effect<HttpClientResponse, HttpClientError | Error, never>;
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

type ReportPayload = {
  payload_metadata: ReportPayloadData;
  result: FeedResult;
};
