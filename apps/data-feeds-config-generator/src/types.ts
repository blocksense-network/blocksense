import * as S from '@effect/schema/Schema';

/**
 * Schema for the data feed types ( Chainlink compatible ).
 */
const FeedTypeSchema = S.Union(
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
);

/**
 * Type for the data feed types.
 */
export type FeedType = S.Schema.Type<typeof FeedTypeSchema>;

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
});

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
});

/**
 * Type for the information about currencies received from CoinMarketCap.
 */
export type CMCInfo = S.Schema.Type<typeof CMCInfoSchema>;

/**
 * Function to decode CoinMarketCap information.
 */
export const decodeCMCInfo = S.decodeUnknownSync(S.Array(CMCInfoSchema));

const ScriptSchema = S.Union(
  S.Literal('CoinMarketCap'),
  S.Literal('YahooFinance'),
);

export type Script = S.Schema.Type<typeof ScriptSchema>;

export const decodeScript = S.decodeUnknownSync(ScriptSchema);

const PairSchema = S.Struct({
  base: S.String,
  quote: S.String,
});

export type Pair = S.Schema.Type<typeof PairSchema>;

const FirstReportStartTimeSchema = S.Struct({
  secs_since_epoch: S.Number,
  nanos_since_epoch: S.Number,
});

/**
 * Schema for the additional resources. This includes the CoinMarketCap ID and quote, and the Yahoo Finance symbol.
 */
const AdditionalResourcesSchema = S.Struct({
  cmc_id: S.optional(S.Number),
  cmc_quote: S.optional(S.String),
  yf_symbol: S.optional(S.String),
});

/**
 * Schema for the Data Feed type.
 */
const FeedSchema = S.Struct({
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
});

/**
 * The Data Feed type.
 */
export type Feed = S.Schema.Type<typeof FeedSchema>;

/**
 * Schema for the Data Feeds configuration.
 */
const FeedsConfigSchema = S.Struct({
  feeds: S.Array(FeedSchema),
});

/**
 * Type for the Data Feeds configuration.
 */
export type FeedsConfig = S.Schema.Type<typeof FeedsConfigSchema>;

/**
 * Function to decode Data Feeds configuration.
 */
export const decodeFeedsConfig = S.decodeUnknownSync(FeedsConfigSchema);

export type RawDataFeeds = {
  [feedName: string]: {
    networks: NetworkMapping;
  };
};

export type NetworkMapping = {
  [networkName: string]: ChainLinkFeedInfo;
};
