import { Effect } from 'effect';
import { describe, expect, it } from '@effect/vitest';

import { createGatewayController, gateEffect, installGateway } from './gateway';

describe('Gateway Controller', () => {
  describe('createGatewayController', () => {
    it('creates controller with non-aborted signal and abort flips it', () => {
      const controller = createGatewayController();

      expect(controller.signal.aborted).toBe(false);

      controller.abort('reason');

      expect(controller.signal.aborted).toBe(true);
      expect(controller.signal.reason).toBe('reason');
    });
  });

  describe('gateEffect', () => {
    it.effect('does not abort on success and returns the value', () =>
      Effect.gen(function* () {
        const controller = createGatewayController();
        const result = yield* gateEffect(controller, Effect.succeed(42));

        expect(result).toBe(42);
        expect(controller.signal.aborted).toBe(false);
      }),
    );

    it.effect('aborts on failure and rethrows the cause', () =>
      Effect.gen(function* () {
        const controller = createGatewayController();
        const error = yield* Effect.flip(
          gateEffect(controller, Effect.fail('boom')),
        );

        expect(error).toBe('boom');
        expect(controller.signal.aborted).toBe(true);
      }),
    );
  });

  describe('installGateway', () => {
    describe('skips subsequent tests after abort', () => {
      const controller = createGatewayController();
      installGateway(controller, 'skip after abort');

      it('aborts the controller in the first test', () => {
        expect(controller.signal.aborted).toBe(false);

        controller.abort('stop');

        expect(controller.signal.aborted).toBe(true);
      });

      it('should be skipped after abort', () => {
        throw new Error('Expected this test to be skipped by installGateway');
      });
    });

    describe('does not skip when not aborted', () => {
      const controller = createGatewayController();
      installGateway(controller, 'should not skip');

      it('runs normally when not aborted', () => {
        expect(controller.signal.aborted).toBe(false);
      });
    });
  });
});
