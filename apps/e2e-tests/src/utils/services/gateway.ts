import { Effect } from 'effect';
import { beforeEach } from '@effect/vitest';

export type GatewayController = {
  readonly signal: AbortSignal;
  abort: (reason?: unknown) => void;
};

export function createGatewayController(): GatewayController {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: (reason?: unknown) => controller.abort(reason),
  };
}

// Installs a suite-scoped beforeEach that skips tests once the controller is aborted.
export function installGateway(
  controller: GatewayController,
  message = 'Skipping due to fail-fast: prerequisite test failed',
): void {
  beforeEach(ctx => {
    if (controller.signal.aborted) {
      ctx.skip(message);
    }
  });
}

/**
 * Wrap an Effect so that if it fails, the controller is aborted and the original failure is rethrown.
 * Use this for the "gate" test whose failure should skip the remaining tests.
 */
export function gateEffect<R, E, A>(
  controller: GatewayController,
  effect: Effect.Effect<R, E, A>,
  reason?: unknown,
): Effect.Effect<R, E, A> {
  return effect.pipe(
    Effect.catchAllCause(cause =>
      Effect.sync(() => controller.abort(reason)).pipe(
        Effect.zipRight(Effect.failCause(cause)),
      ),
    ),
  );
}
