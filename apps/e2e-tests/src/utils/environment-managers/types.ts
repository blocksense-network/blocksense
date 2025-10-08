import type { Effect } from 'effect';
import { Context, Data } from 'effect';

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
