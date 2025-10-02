import type { Effect } from 'effect';
import { Context, Data, Schema as S } from 'effect';

import { type FeedResult } from './generate-signature';

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
