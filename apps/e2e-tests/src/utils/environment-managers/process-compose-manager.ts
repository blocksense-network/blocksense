import { Layer, Effect } from 'effect';

import {
  startEnvironment,
  stopEnvironment,
  parseProcessesStatus,
} from '../../test-scenarios/general/helpers';
import { EnvironmentManager, EnvironmentError } from '../types';

export const ProcessComposeLive = Layer.succeed(
  EnvironmentManager,
  EnvironmentManager.of({
    start: (environmentName: string) =>
      Effect.tryPromise({
        try: () => startEnvironment(environmentName),
        catch: error =>
          new EnvironmentError({
            message: `Failed to start environment "${environmentName}": ${String(error)}`,
          }),
      }),
    stop: () =>
      Effect.tryPromise({
        try: () => stopEnvironment(),
        catch: error =>
          new EnvironmentError({
            message: `Failed to stop environment: ${String(error)}`,
          }),
      }),
    getProcessesStatus: () =>
      Effect.tryPromise({
        try: () => parseProcessesStatus(),
        catch: error =>
          new EnvironmentError({
            message: `Failed to parse processes status: ${String(error)}`,
          }),
      }),
  }),
);
