import { Schema as S } from 'effect';

import { AdditionalFeedInfoSchema, OracleIdSchema } from './oracles';
/**
 * Schema for the data feed category ( Chainlink compatible ).
 */
export const FeedCategorySchema = S.Union(
  S.Literal(''),
  S.Literal('Crypto'),
  S.Literal('Currency'),
  S.Literal('Equities'),
  S.Literal('Fiat'),
  S.Literal('Fixed Income'),
  S.Literal('FX_Spot'),
  S.Literal('Commodities'),
  S.Literal('Forex'),
  S.Literal('Economic index'),
  S.Literal('US Treasuries'),
  S.Literal('Tokenized Asset'),
).annotations({ identifier: 'FeedCategory' });

/**
 * Type for the data feed categories.
 */
export type FeedCategory = S.Schema.Type<typeof FeedCategorySchema>;

export const PairSchema = S.mutable(
  S.Struct({
    base: S.String,
    quote: S.String,
  }),
).annotations({ identifier: 'Pair' });

export type Pair = S.Schema.Type<typeof PairSchema>;

/**
 * Creates a `Pair` object with the given base and quote currencies.
 */
export function createPair(base: string, quote: string): Pair {
  return { base, quote };
}

/**
 * Canonical string representation of a `Pair` object.
 */
export function pairToString(pair: Pair): string {
  return `${pair.base} / ${pair.quote}`;
}

export const FirstReportStartTimeSchema = S.mutable(
  S.Struct({
    secs_since_epoch: S.Number,
    nanos_since_epoch: S.Number,
  }),
).annotations({ identifier: 'FirstReportStartTime' });

/**
 * Schema for the additional resources. This includes the CoinMarketCap ID and quote, and the Yahoo Finance symbol.
 */
export const AdditionalResourcesSchema = S.mutable(
  S.Struct({
    cmc_id: S.optional(S.Number),
    cmc_quote: S.optional(S.String),
    yf_symbol: S.optional(S.String),
  }),
);

/**
 * Schema for the Data Feed type.
 */
export const FeedSchema = S.mutable(
  S.Struct({
    id: S.Number,
    name: S.String,
    fullName: S.String,
    type: FeedCategorySchema,
    description: S.String,
    decimals: S.Number,
    script: S.String,
    pair: PairSchema,
    report_interval_ms: S.Number,
    first_report_start_time: FirstReportStartTimeSchema,
    quorum_percentage: S.Number,
    resources: AdditionalResourcesSchema,
  }),
);

/**
 * The Data Feed type.
 */
export type Feed = S.Schema.Type<typeof FeedSchema>;

/**
 * Function to decode the Data Feed.
 */
export const decodeFeed = S.decodeUnknownSync(FeedSchema);

/**
 * Schema for the Data Feeds configuration.
 */
export const FeedsConfigSchema = S.mutable(
  S.Struct({
    feeds: S.mutable(S.Array(FeedSchema)),
  }),
);

/**
 * Type for the Data Feeds configuration.
 */
export type FeedsConfig = S.Schema.Type<typeof FeedsConfigSchema>;

/**
 * Function to decode Data Feeds configuration.
 */
export const decodeFeedsConfig = S.decodeUnknownSync(FeedsConfigSchema);

/**
 * Schema for the data feed type.
 */
export const FeedTypeSchema = S.Union(S.Literal('price-feed')).annotations({
  identifier: 'FeedType',
});

/**
 * Type for the data feed type.
 */
export type FeedType = S.Schema.Type<typeof FeedTypeSchema>;

/**
 * Schema for the data feed market hours ( Chainlink compatible ).
 */
export const MarketHoursSchema = S.Union(
  S.Literal(''),
  S.Literal('Crypto'),
  S.Literal('Forex'),
  S.Literal('FX'),
  S.Literal('NYSE'),
  S.Literal('WTI'),
  S.Literal('LSE'),
  S.Literal('MI_ETF'),
  S.Literal('NYMEX'),
  S.Literal('Euronext_Milan'),
  S.Literal('Precious_Metals'),
  S.Literal('UK_ETF'),
  S.Literal('US_Equities'),
).annotations({ identifier: 'MarketHours' });

export type MarketHours = S.Schema.Type<typeof MarketHoursSchema>;

export const NewFeedSchema = S.mutable(
  S.Struct({
    id: S.Number,
    full_name: S.String,
    description: S.String,

    type: S.Union(S.Literal('price-feed')).annotations({
      identifier: 'FeedType',
    }),
    oracle_id: OracleIdSchema,

    value_type: S.Union(
      S.Literal('numerical'),
      S.Literal('text'),
      S.Literal('bytes'),
    ).annotations({
      identifier: 'ValueType',
    }),

    stride: S.Int,

    quorum: S.Struct({
      percentage: S.Number,
      aggregation: S.Union(S.Literal('median')).annotations({
        identifier: 'QuorumAggregation',
      }),
    }),

    schedule: S.Struct({
      interval_ms: S.Number,
      heartbeat_ms: S.Number,
      deviation_percentage: S.Number,
      first_report_start_unix_time_ms: S.Number,
    }),

    additional_feed_info: AdditionalFeedInfoSchema,
  }),
);

export type NewFeed = S.Schema.Type<typeof NewFeedSchema>;

/**
 * Schema for the Data Feeds configuration.
 */
export const NewFeedsConfigSchema = S.mutable(
  S.Struct({
    feeds: S.mutable(S.Array(NewFeedSchema)),
  }),
);

/**
 * Type for the Data Feeds configuration.
 */
export type NewFeedsConfig = S.Schema.Type<typeof NewFeedsConfigSchema>;

/**
 * Function to decode Data Feeds configuration.
 */
export const decodeNewFeedsConfig = S.decodeUnknownSync(NewFeedsConfigSchema);
