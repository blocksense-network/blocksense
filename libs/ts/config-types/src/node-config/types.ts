import { Schema as S } from 'effect';

import { PortSchema } from '@blocksense/base-utils/schemas';

import { StrideSchema, FeedIdSchema } from '../data-feeds-config/types';

// This is a partial schema including only allowed feeds
// TODO: (danielstoyanov) Expand to whole config schema
export const SequencerConfigV1Schema = S.mutable(
  S.Struct({
    providers: S.Record({
      key: S.String,
      value: S.Struct({
        allow_feeds: S.optional(S.Array(S.Number)),
      }),
    }),
  }),
);

export type SequencerConfigV1 = typeof SequencerConfigV1Schema.Type;

const BlockConfigSchema = S.Struct({
  max_feed_updates_to_batch: S.Number,
  block_generation_period: S.Number,
  genesis_block_timestamp_ms: S.NullishOr(S.Number),
  aggregation_consensus_discard_period_blocks: S.Number,
});

const ReporterSchema = S.Struct({
  id: S.Number,
  pub_key: S.String,
  address: S.String,
});

const PublishingCriteriaSchema = S.Struct({
  feed_id: FeedIdSchema,
  stride: StrideSchema,
  skip_publish_if_less_then_percentage: S.Number,
  always_publish_heartbeat_ms: S.NullishOr(S.Number),
  peg_to_value: S.NullishOr(S.Number),
  peg_tolerance_percentage: S.Number,
});

const ContractSchema = S.Struct({
  name: S.String,
  address: S.NullishOr(S.String),
  creation_byte_code: S.NullishOr(S.String),
  deployed_byte_code: S.NullishOr(S.String),
  min_quorum: S.NullishOr(S.Number),
});

const ProviderSchema = S.Struct({
  private_key_path: S.String,
  url: S.URL,
  transaction_retries_count_limit: S.Number,
  transaction_retry_timeout_secs: S.Number,
  retry_fee_increment_fraction: S.Number,
  transaction_gas_limit: S.Number,
  impersonated_anvil_account: S.NullishOr(S.String),
  is_enabled: S.Boolean,
  should_load_round_counters: S.NullishOr(S.Boolean),
  allow_feeds: S.optional(S.Array(FeedIdSchema)),
  publishing_criteria: S.Array(PublishingCriteriaSchema),
  contracts: S.Array(ContractSchema),
});

const PyroscopeConfigSchema = S.Struct({
  user: S.NullishOr(S.String),
  password_file_path: S.NullishOr(S.String),
  url: S.String,
  sample_rate: S.Number,
});

export const SequencerConfigV2Schema = S.mutable(
  S.Struct({
    sequencer_id: S.Number,
    main_port: PortSchema,
    admin_port: PortSchema,
    prometheus_port: PortSchema,
    block_config: BlockConfigSchema,
    providers: S.Record({
      key: S.String,
      value: ProviderSchema,
    }),
    reporters: S.Array(ReporterSchema),
    kafka_report_endpoint: S.Struct({
      url: S.NullishOr(S.String),
    }),
    http_input_buffer_size: S.NullishOr(S.Number),
    pyroscope_config: S.NullishOr(PyroscopeConfigSchema),
  }),
);

export type SequencerConfigV2 = typeof SequencerConfigV2Schema.Type;
