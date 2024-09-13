import * as S from '@effect/schema/Schema';

/**
 * Schema for the data feed types ( Chainlink compatible ).
 */
export const FeedTypeSchema = S.mutable(
  S.Union(
    S.Literal(''),
    S.Literal('Crypto'),
    S.Literal('Currency'),
    S.Literal('Equities'),
    S.Literal('Fiat'),
    S.Literal('Fixed Income'),
    S.Literal('Fixed-Income'),
    S.Literal('Commodities'),
    S.Literal('Forex'),
    S.Literal('Economic index'),
    S.Literal('US Treasuries'),
  ),
);

/**
 * Type for the data feed types.
 */
export type FeedType = S.Schema.Type<typeof FeedTypeSchema>;

/**
 * Schema for the scripts that can be used to fetch data.
 */
export const ScriptSchema = S.Union(
  S.Literal('CoinMarketCap'),
  S.Literal('YahooFinance'),
);

export type Script = S.Schema.Type<typeof ScriptSchema>;

export const decodeScript = S.decodeUnknownSync(ScriptSchema);

const PairSchema = S.mutable(
  S.Struct({
    base: S.String,
    quote: S.String,
  }),
);

export type Pair = S.Schema.Type<typeof PairSchema>;

const FirstReportStartTimeSchema = S.mutable(
  S.Struct({
    secs_since_epoch: S.Number,
    nanos_since_epoch: S.Number,
  }),
);

/**
 * Schema for the additional resources. This includes the CoinMarketCap ID and quote, and the Yahoo Finance symbol.
 */
const AdditionalResourcesSchema = S.mutable(
  S.Struct({
    cmc_id: S.optional(S.Number),
    cmc_quote: S.optional(S.String),
    yf_symbol: S.optional(S.String),
  }),
);

/**
 * Schema for the Data Feed type.
 */
const FeedSchema = S.mutable(
  S.Struct({
    id: S.Number,
    name: S.String,
    fullName: S.String,
    type: FeedTypeSchema,
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
const FeedsConfigSchema = S.mutable(
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
