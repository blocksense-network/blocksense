import { Data, Schema as S } from 'effect';

// Metric type definitions
const Labels = S.Record({
  key: S.String,
  value: S.String,
});

const MetricSchema = S.Struct({
  value: S.NumberFromString,
  labels: S.optional(Labels),
});

const MetricType = S.Literal('COUNTER', 'GAUGE', 'HISTOGRAM', 'SUMMARY');

const PrometheusMetricSchema = S.Struct({
  name: S.String,
  help: S.String,
  type: MetricType,
  metrics: S.Array(MetricSchema),
});

export const PrometheusMetricsSchema = S.Array(PrometheusMetricSchema);

export type PrometheusMetrics = typeof PrometheusMetricsSchema.Type;

// Error types definitions
export class ParseMetricsError extends Data.TaggedError(
  '@e2e-tests/ParseMetricsError',
)<{
  readonly message: string; // 'Failed to parse the Prometheus text format!'
}> {}
