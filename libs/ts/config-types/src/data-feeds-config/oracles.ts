import { Schema as S } from 'effect';

// `cex-price-feeds` Oracle related Types
export const cexProviderInfo = S.mutable(
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

export const cexPriceFeedsArgsSchema = S.mutable(
  S.Struct({
    exchanges: S.optional(cexProviderInfo),
    aggregators: S.optional(cexProviderInfo),
  }),
);

export type CexPriceFeedsArgs = typeof cexPriceFeedsArgsSchema.Type;

// `gecko-terminal` Oracle related Types
export const geckoTerminalArgsSchema = S.mutable(
  S.Array(
    S.Struct({
      network: S.String,
      pool: S.String,
      reverse: S.Boolean,
      min_volume_usd: S.Number,
    }),
  ),
);

// `stock-price-feeds` Oracle related Types
export const stockPriceFeedsArgsSchema = S.mutable(
  S.Struct({
    providers: S.Array(S.String),
  }),
);

// `eth-rpc` Oracle related Types
// Schema for a single URL string
const UrlSchema = S.String.pipe(
  S.pattern(/^https?:\/\/[^\s/$.?#].[^\s]*$/),
  S.annotations({
    identifier: 'HttpUrl',
    description: 'A valid HTTP/HTTPS URL',
  }),
);

export const ethRpcArgsSchema = S.mutable(S.Array(UrlSchema)).annotations({
  identifier: 'EthRpcOracleArgs',
});
