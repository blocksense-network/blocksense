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
      startEnvironment(environmentName).pipe(
        Effect.mapError(
          error =>
            new EnvironmentError({
              message: `Failed to start environment "${environmentName}": ${String(error)}`,
            }),
        ),
      ),
    stop: () =>
      stopEnvironment().pipe(
        Effect.mapError(
          error =>
            new EnvironmentError({
              message: `Failed to stop environment: ${String(error)}`,
            }),
        ),
      ),
    getProcessesStatus: () =>
      parseProcessesStatus().pipe(
        Effect.mapError(
          error =>
            new EnvironmentError({
              message: `Failed to parse processes status: ${String(error)}`,
            }),
        ),
      ),
  }),
);
