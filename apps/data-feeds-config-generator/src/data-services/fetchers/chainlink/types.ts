import { Schema as S } from 'effect';

import {
  FeedCategorySchema,
  MarketHoursSchema,
} from '@blocksense/config-types/data-feeds-config';

const ChainLinkFeedDocsInfoSchema = S.Struct({
  assetName: S.NullishOr(S.String),
  baseAsset: S.NullishOr(S.String),
  quoteAsset: S.NullishOr(S.String),
  marketHours: S.NullishOr(MarketHoursSchema),
  productType: S.NullishOr(S.String),
  feedType: S.NullishOr(S.String),
  assetSubClass: S.NullishOr(S.String),
  hidden: S.NullishOr(S.Boolean),
}).annotations({ identifier: 'ChainLinkFeedDocsInfo' });

export type ChainLinkFeedDocsInfo = typeof ChainLinkFeedDocsInfoSchema.Type;

/**
 * Schema for the ChainLink feed information.
 */
export const ChainLinkFeedInfoSchema = S.Struct({
  compareOffchain: S.String,
  contractAddress: S.String,
  contractType: S.String,
  contractVersion: S.Number,
  decimalPlaces: S.NullishOr(S.Number),
  ens: S.NullishOr(S.String),
  formatDecimalPlaces: S.NullishOr(S.Number),
  healthPrice: S.String,
  heartbeat: S.NullishOr(S.Number),
  history: S.NullishOr(S.Boolean),
  multiply: S.String,
  name: S.String,
  pair: S.Array(S.String),
  path: S.String,
  proxyAddress: S.NullishOr(S.String),
  threshold: S.Number,
  valuePrefix: S.String,
  assetName: S.String,
  feedType: S.Union(
    S.Literal('crypto'),
    S.Literal('Fixed-Income'),
    ...FeedCategorySchema.members,
  ),
  decimals: S.Number,
  docs: ChainLinkFeedDocsInfoSchema,
}).annotations({ identifier: 'ChainLinkFeedInfo' });

/**
 * Type for the ChainLink feed information.
 */
export type ChainLinkFeedInfo = typeof ChainLinkFeedInfoSchema.Type;

/**
 * Function to decode an array of ChainLink feed information.
 */
export const decodeChainLinkFeedsInfo = S.decodeUnknownSync(
  S.Array(ChainLinkFeedInfoSchema),
);

export const RawDataFeedsSchema = S.mutable(
  S.Record({
    key: S.String,
    value: S.Struct({
      networks: S.mutable(
        S.Record({
          key: S.String,
          value: ChainLinkFeedInfoSchema,
        }),
      ),
    }),
  }),
).annotations({ identifier: 'RawDataFeeds' });

export type RawDataFeeds = typeof RawDataFeedsSchema.Type;
