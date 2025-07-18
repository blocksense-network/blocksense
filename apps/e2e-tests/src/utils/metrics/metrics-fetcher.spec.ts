import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { getMetrics } from './metrics-fetcher';
import { FetchMetricsError, ParseMetricsError } from './types';

describe('Metrics fetcher tests', () => {
  const test_url = 'http://localhost:8080/metrics';

  it('should return PrometheusMetrics on successful fetch and parse', async () => {
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

    const result = await Effect.runPromise(getMetrics(test_url));

    expect(result).toEqual([
      {
        name: 'l2_chain_id',
        help: 'The chain ID of the L2 chain.',
        type: 'GAUGE',
        metrics: [{ value: 12345 }],
      },
    ]);
  });

  it('should return FetchMetricsError on fetch failure', async () => {
    const mockError = new Error('Network error');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mockError));

    const result = await Effect.runPromise(Effect.flip(getMetrics(test_url)));

    expect(result).toBeInstanceOf(FetchMetricsError);
    expect(result._tag).toBe('FetchMetricsError');
  });

  it('should return ParseMetricsError on invalid prometheus format', async () => {
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

    const result = await Effect.runPromise(Effect.flip(getMetrics(test_url)));

    expect(result).toBeInstanceOf(ParseMetricsError);
    expect(result._tag).toBe('ParseMetricsError');
  });

  it('should return ValidationError on schema validation failure', async () => {
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

    const result = await Effect.runPromise(Effect.flip(getMetrics(test_url)));

    expect(result.message).toMatch(/invalid/i);
    expect(result._tag).toBe('ParseError');
  });
});
