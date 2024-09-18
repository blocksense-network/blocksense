import * as S from '@effect/schema/Schema';

import { chainId, ethereumAddress } from '@blocksense/base-utils/evm-utils';

import { denominationAddress } from './denominations';

const ChainlinkAggregatorProxySchema = S.Record({
  key: chainId,
  value: S.NullishOr(ethereumAddress),
});

export type ChainlinkAggregatorProxy = S.Schema.Type<
  typeof ChainlinkAggregatorProxySchema
>;

const ChainlinkCompatibilityDataSchema = S.Struct({
  base: S.NullishOr(denominationAddress),
  quote: S.NullishOr(denominationAddress),
  chainlink_aggregator_proxies: ChainlinkAggregatorProxySchema,
});

export type ChainlinkCompatibilityData = S.Schema.Type<
  typeof ChainlinkCompatibilityDataSchema
>;

const BlocksenseFeedsCompatibilitySchema = S.Record({
  key: S.String,
  value: S.Struct({
    id: S.Number,
    description: S.String,
    chainlink_compatibility: ChainlinkCompatibilityDataSchema,
  }),
});

export type BlocksenseFeedsCompatibility = S.Schema.Type<
  typeof BlocksenseFeedsCompatibilitySchema
>;

export const ChainlinkAddressToBlocksenseIdSchema = S.Record({
  key: S.String,
  value: S.NullishOr(S.Number),
});

export type ChainlinkAddressToBlocksenseId = S.Schema.Type<
  typeof ChainlinkAddressToBlocksenseIdSchema
>;

const ChainlinkCompatibilityConfigSchema = S.Struct({
  blocksenseFeedsCompatibility: BlocksenseFeedsCompatibilitySchema,
  chainlinkAddressToBlocksenseId: ChainlinkAddressToBlocksenseIdSchema,
});

export type ChainlinkCompatibilityConfig = S.Schema.Type<
  typeof ChainlinkCompatibilityConfigSchema
>;

export const decodeChainlinkCompatibilityConfig = S.decodeUnknownSync(
  ChainlinkCompatibilityConfigSchema,
);
