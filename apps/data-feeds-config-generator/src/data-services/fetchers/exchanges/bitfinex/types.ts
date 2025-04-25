import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Bitfinex Exchange oracle.
 *
 * Ref: https://docs.bitfinex.com/reference/rest-public-tickers
 */
export const BitfinexAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type BitfinexAssetInfo = S.Schema.Type<typeof BitfinexAssetInfoSchema>;

/**
 * Schema for the relevant information about products received from Bitfinex Exchange.
 */
export const BitfinexInfoRespSchema = S.mutable(
  S.Array(S.mutable(S.Array(S.String))),
);

export type BitfinexInfoResp = S.Schema.Type<typeof BitfinexInfoRespSchema>;

/**
 * Schema for the price information received from Bitfinex Exchange.
 */
export const BitfinexPriceSchema = S.mutable(
  S.Array(S.Array(S.Union(S.String, S.Number))),
);

export type BitfinexPrice = S.Schema.Type<typeof BitfinexPriceSchema>;
