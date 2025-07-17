import { Effect, Schema as S } from 'effect';
import type { ParseError } from 'effect/ParseResult';
import type { HttpClientError } from '@effect/platform';
import { FetchHttpClient, HttpClientRequest } from '@effect/platform';
import { HttpClient } from '@effect/platform/HttpClient';
import parsePrometheusTextFormat from 'parse-prometheus-text-format';

import type { PrometheusMetrics } from './types';
import { ParseMetricsError, PrometheusMetricsSchema } from './types';

export const getMetrics = (
  url: string,
): Effect.Effect<
  PrometheusMetrics,
  ParseMetricsError | HttpClientError.HttpClientError | ParseError
> => {
  return Effect.gen(function* () {
    const client = yield* HttpClient;
    const request = HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeader('Accept', 'application/json'),
    );
    const response = yield* client.execute(request);
    const metricsAsStr = yield* response.text;

    const parsedMetrics = yield* Effect.tryPromise({
      try: () => Promise.resolve(parsePrometheusTextFormat(metricsAsStr)),
      catch: error => new ParseMetricsError({ message: `${error}` }),
    });

    const decodedMetrics = yield* S.decodeUnknown(PrometheusMetricsSchema)(
      parsedMetrics,
    );

    return decodedMetrics;
  }).pipe(Effect.provide(FetchHttpClient.layer));
};
