import * as S from '@effect/schema/Schema';

import { FeedTypeSchema } from '@blocksense/config-types/data-feeds-config';

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
  feedType: FeedTypeSchema,
  decimals: S.Number,
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

/**
 * Schema for the information about currencies received from CoinMarketCap.
 */
const CMCInfoSchema = S.Struct({
  id: S.Number,
  rank: S.Number,
  name: S.String,
  symbol: S.String,
  slug: S.String,
  is_active: S.Number,
  first_historical_data: S.NullishOr(S.Date),
  last_historical_data: S.NullishOr(S.Date),
  platform: S.NullishOr(
    S.Struct({
      id: S.Number,
      name: S.String,
      symbol: S.String,
      slug: S.String,
      token_address: S.String,
    }),
  ),
}).annotations({ identifier: 'CMCInfo' });

/**
 * Type for the information about currencies received from CoinMarketCap.
 */
export type CMCInfo = S.Schema.Type<typeof CMCInfoSchema>;

/**
 * Function to decode CoinMarketCap information.
 */
export const decodeCMCInfo = S.decodeUnknownSync(S.Array(CMCInfoSchema));

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
