import { Schema as S } from 'effect';

/**
 * Schema for the relevant information about products received from Bitfinex Exchange.
 */
export const BitfinexExchangeInfoRespSchema = S.mutable(
  S.Array(S.Array(S.String)),
);

export type BitfinexExchangeInfoResp = S.Schema.Type<
  typeof BitfinexExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a Bitfinex Exchange oracle.
 *
 * Ref: https://docs.bitfinex.com/reference/rest-public-tickers
 */
export const BitfinexExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BitfinexExchangeAssetInfo = S.Schema.Type<
  typeof BitfinexExchangeAssetInfoSchema
>;
