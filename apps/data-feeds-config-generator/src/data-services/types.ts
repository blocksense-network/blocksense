import * as S from '@effect/schema/Schema';

import {
  FeedCategorySchema,
  MarketHoursSchema,
} from '@blocksense/config-types/data-feeds-config';

/**
 * Schema for the ChainLink feed information.
 */
const ChainLinkFeedInfoSchema = S.Struct({
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
  feedType: FeedCategorySchema,
  decimals: S.Number,
  docs: S.Struct({
    assetName: S.NullishOr(S.String),
    baseAsset: S.NullishOr(S.String),
    quoteAsset: S.NullishOr(S.String),
    marketHours: S.NullishOr(MarketHoursSchema),
  }),
}).annotations({ identifier: 'ChainLinkFeedInfo' });

/**
 * Type for the ChainLink feed information.
 */
export type ChainLinkFeedInfo = S.Schema.Type<typeof ChainLinkFeedInfoSchema>;

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

export type RawDataFeeds = S.Schema.Type<typeof RawDataFeedsSchema>;
