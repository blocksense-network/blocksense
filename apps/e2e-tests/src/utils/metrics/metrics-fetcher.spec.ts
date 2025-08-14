import { Effect } from 'effect';
import { afterAll, expect, it, vi } from '@effect/vitest';
import { FetchHttpClient, HttpClientError } from '@effect/platform';

import { getMetrics } from './metrics-fetcher';
import { ParseMetricsError } from './types';

it.layer(FetchHttpClient.layer)('Metrics fetcher tests', it => {
  const test_url = 'http://localhost:8080/metrics';

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.effect(
    'should return PrometheusMetrics on successful fetch and parse',
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: true,
            text: () =>
              Promise.resolve(
                `
            # HELP l2_chain_id The chain ID of the L2 chain.
            # TYPE l2_chain_id gauge
            l2_chain_id 12345
            `,
              ),
          }),
        );

        const result = yield* getMetrics(test_url);

        expect(result).toEqual([
          {
            name: 'l2_chain_id',
            help: 'The chain ID of the L2 chain.',
            type: 'GAUGE',
            metrics: [{ value: 12345 }],
          },
        ]);
      }),
  );

  it.effect(
    'should return HttpClientError.ResponseError on fetch failure',
    () =>
      Effect.gen(function* () {
        const mockError = new Error('Network error');

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mockError));

        const result = yield* Effect.flip(getMetrics(test_url));
        expect(result).toBeInstanceOf(HttpClientError.RequestError);
        expect(result._tag).toBe('RequestError');
      }),
  );

  it.effect(
    'should return @e2e-tests/ParseMetricsError on invalid prometheus format',
    () =>
      Effect.gen(function* () {
        const mockMetrics = 'invalid metrics';
        const mockResponse = {
          ok: true,
          text: () => Promise.resolve(mockMetrics),
        };

        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockResponse),
          }),
        );

        const result = yield* Effect.flip(getMetrics(test_url));

        expect(result).toBeInstanceOf(ParseMetricsError);
        expect(result._tag).toBe('@e2e-tests/ParseMetricsError');
      }),
  );

  it.effect('should return ParseError on schema validation failure', () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () =>
            Promise.resolve(
              `
              # HELP l2_chain_id The chain ID of the L2 chain.
              # TYPE l2_chain_id gauge
              l2_chain_id "invalid_value"
              `,
            ),
        }),
      );

      const result = yield* Effect.flip(getMetrics(test_url));

      // The metric type is gauge, but the value is a string, which is invalid.
      expect(result.message).toMatch(
        /Unable to decode "\\".*?\\"" into a number/,
      );
      expect(result._tag).toBe('ParseError');
    }),
  );
});
