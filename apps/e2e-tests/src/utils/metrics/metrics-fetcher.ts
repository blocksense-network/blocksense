import { Effect, Schema as S, pipe } from 'effect';
import parsePrometheusTextFormat from 'parse-prometheus-text-format';

import type { PrometheusMetrics } from './types';
import {
  FetchMetricsError,
  ParseMetricsError,
  PrometheusMetricsSchema,
} from './types';
import type { ParseError } from 'effect/ParseResult';

export const getMetrics = (
  url: string,
): Effect.Effect<
  PrometheusMetrics,
  FetchMetricsError | ParseMetricsError | ParseError
> => {
  return pipe(
    Effect.tryPromise({
      try: () => fetch(url).then(response => response.text()),
      catch: error => new FetchMetricsError(error),
    }),
    Effect.flatMap(metricsAsStr =>
      Effect.try({
        try: () => parsePrometheusTextFormat(metricsAsStr),
        catch: error => new ParseMetricsError(error),
      }),
    ),
    Effect.flatMap(S.decode(PrometheusMetricsSchema)), // May produce ParseError
  );
};
