import { Schema as S } from 'effect';

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
