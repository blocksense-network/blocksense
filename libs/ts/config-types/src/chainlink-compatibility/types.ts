import { Schema as S } from 'effect';

import { networkName, ethereumAddress } from '@blocksense/base-utils/evm';

const [_local, ...networkNames] = networkName.literals;

export const ChainlinkAggregatorsSchema = S.Record({
  key: S.Literal(...networkNames),
  value: S.UndefinedOr(ethereumAddress),
}).annotations({ identifier: 'ChainlinkAggregators' });

export type ChainlinkAggregators = S.Schema.Type<
  typeof ChainlinkAggregatorsSchema
>;

export const ChainlinkCompatibilityDataSchema = S.Struct({
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
  chainlink_aggregators: ChainlinkAggregatorsSchema,
}).annotations({ identifier: 'ChainlinkCompatibilityData' });

export type ChainlinkCompatibilityData = S.Schema.Type<
  typeof ChainlinkCompatibilityDataSchema
>;

export const BlocksenseFeedsCompatibilitySchema = S.Record({
  key: S.String,
  value: S.Struct({
    id: S.Number,
    description: S.String,
    chainlink_compatibility: ChainlinkCompatibilityDataSchema,
  }),
}).annotations({ identifier: 'BlocksenseFeedsCompatibility' });

export type BlocksenseFeedsCompatibility = S.Schema.Type<
  typeof BlocksenseFeedsCompatibilitySchema
>;

export const ChainlinkAddressToBlocksenseIdSchema = S.Record({
  key: S.String,
  value: S.NullishOr(S.Number),
}).annotations({ identifier: 'ChainlinkAddressToBlocksenseId' });

export type ChainlinkAddressToBlocksenseId = S.Schema.Type<
  typeof ChainlinkAddressToBlocksenseIdSchema
>;

export const ChainlinkCompatibilityConfigSchema = S.Struct({
  blocksenseFeedsCompatibility: BlocksenseFeedsCompatibilitySchema,
  chainlinkAddressToBlocksenseId: ChainlinkAddressToBlocksenseIdSchema,
}).annotations({ identifier: 'ChainlinkCompatibilityConfig' });

export type ChainlinkCompatibilityConfig = S.Schema.Type<
  typeof ChainlinkCompatibilityConfigSchema
>;

export const decodeChainlinkCompatibilityConfig = S.decodeUnknownSync(
  ChainlinkCompatibilityConfigSchema,
);
