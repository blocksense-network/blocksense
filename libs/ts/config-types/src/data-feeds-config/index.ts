import * as S from '@effect/schema/Schema';

/**
 * Schema for the data feed category ( Chainlink compatible ).
 */
export const FeedCategorySchema = S.Union(
  S.Literal(''),
  S.Literal('crypto'),
  S.Literal('Crypto'),
  S.Literal('Currency'),
  S.Literal('Equities'),
  S.Literal('Fiat'),
  S.Literal('Fixed Income'),
  S.Literal('Fixed-Income'),
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

/**
 * Schema for the scripts that can be used to fetch data.
 */
export const ScriptSchema = S.Union(
  S.Literal('CoinMarketCap'),
  S.Literal('YahooFinance'),
).annotations({ identifier: 'ScriptName' });

export type Script = S.Schema.Type<typeof ScriptSchema>;

export const decodeScript = S.decodeUnknownSync(ScriptSchema);

export const PairSchema = S.mutable(
  S.Struct({
    base: S.String,
    quote: S.String,
  }),
).annotations({ identifier: 'Pair' });

export type Pair = S.Schema.Type<typeof PairSchema>;

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
    script: ScriptSchema,
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
 * Schema for the data feed market hours ( Chainlink compatible ).
 */
export const MarketHoursSchema = S.Union(
  S.Literal('Crypto'),
  S.Literal('Forex'),
  S.Literal('FX'),
  S.Literal('MI_ETF'),
  S.Literal('NYMEX'),
  S.Literal('Precious_Metals'),
  S.Literal('UK_ETF'),
  S.Literal('US_Equities'),
).annotations({ identifier: 'MarketHours' });

export type MarketHours = S.Schema.Type<typeof MarketHoursSchema>;
