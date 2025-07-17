import { Schema as S } from 'effect';

// Metric type definitions
const Labels = S.Record({
  key: S.String,
  value: S.String,
});

const MetricSchema = S.Struct({
  value: S.NumberFromString,
  labels: S.optional(Labels),
});

const MetricType = S.Literal(
  'COUNTER',
  'GAUGE',
  'HISTOGRAM',
  'SUMMARY',
  'UNTYPED',
);

const PrometheusMetricSchema = S.Struct({
  name: S.String,
  help: S.String,
  type: MetricType,
  metrics: S.Array(MetricSchema),
});

export const PrometheusMetricsSchema = S.Array(PrometheusMetricSchema);

export type PrometheusMetric = S.Schema.Type<typeof PrometheusMetricSchema>;
export type PrometheusMetrics = S.Schema.Type<typeof PrometheusMetricsSchema>;

// Error types definitions
export class FetchMetricsError extends Error {
  readonly _tag = 'FetchMetricsError';
  constructor(readonly error: unknown) {
    super("Couldn't fetch the /metrics endpoint!");
  }
}

export class ParseMetricsError extends Error {
  readonly _tag = 'ParseMetricsError';
  constructor(readonly error: unknown) {
    super('Failed to parse the Prometheus text format!');
  }
}
