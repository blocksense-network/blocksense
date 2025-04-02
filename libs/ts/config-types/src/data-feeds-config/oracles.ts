import { Schema as S } from 'effect';
import { PairSchema, FeedCategorySchema, MarketHoursSchema } from './types';

export const OracleIdSchema = S.Union(
  S.Literal('crypto-price-feeds'),
  S.Literal('gecko-terminal'),
  S.Literal('exsat-holdings'),
).annotations({ identifier: 'OracleId' });

export type OracleId = S.Schema.Type<typeof OracleIdSchema>;

// `crypto-price-feeds` Oracle related Types
export const cryptoProviderInfo = S.mutable(
  S.Record({
    key: S.String,
    value: S.mutable(
      S.Record({
        key: S.String,
        value: S.Array(S.Union(S.String, S.Number)),
      }),
    ),
  }),
);

export const cryptoPriceFeedsArgsSchema = S.mutable(
  S.Struct({
    exchanges: S.optional(cryptoProviderInfo),
    aggregators: S.optional(cryptoProviderInfo),
  }),
);

export type CryptoPriceFeedsArgs = S.Schema.Type<
  typeof cryptoPriceFeedsArgsSchema
>;

// `gecko-terminal` Oracle related Types
export const geckoTerminalArgsSchema = S.mutable(
  S.Array(
    S.Struct({
      network: S.String,
      pool: S.String,
      reverse: S.Boolean,
    }),
  ),
);

// `exsat-holdings` Oracle related Types
export const exsatHoldingsArgsSchema = S.mutable(S.Struct({}));

// Base shape shared by all additional_feed_info
export const AdditionalFeedInfoBaseSchema = {
  pair: PairSchema,
  decimals: S.Number,
  category: FeedCategorySchema,
  market_hours: S.NullishOr(MarketHoursSchema),
  compatibility_info: S.UndefinedOr(S.Struct({ chainlink: S.String })),
};

// crypto-price-feeds specific additional feed info
export const AFI_cryptoPriceFeeds = S.Struct({
  ...AdditionalFeedInfoBaseSchema,
  oracle_id: S.Literal('crypto-price-feeds'),
  arguments: cryptoPriceFeedsArgsSchema,
});

// gecko-terminal specific additional feed info
export const AFI_geckoTerminal = S.Struct({
  ...AdditionalFeedInfoBaseSchema,
  oracle_id: S.Literal('gecko-terminal'),
  arguments: geckoTerminalArgsSchema,
});

// exsat-holdings specific additional feed info
export const AFI_exsatHoldings = S.Struct({
  ...AdditionalFeedInfoBaseSchema,
  oracle_id: S.Literal('exsat-holdings'),
  arguments: exsatHoldingsArgsSchema,
});

export const AdditionalFeedInfoSchema = S.Union(
  AFI_cryptoPriceFeeds,
  AFI_geckoTerminal,
  AFI_exsatHoldings,
).annotations({ identifier: 'AdditionalFeedInfo' });
