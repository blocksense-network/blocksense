import { Schema as S } from 'effect';

/**
 * Schema for the relevant information about products received from Bitfinex Exchange.
 */
export const BitfinexInfoRespSchema = S.mutable(S.Array(S.Array(S.String)));

export type BitfinexInfoResp = S.Schema.Type<typeof BitfinexInfoRespSchema>;

/**
 * Schema for the data relevant to a Bitfinex Exchange oracle.
 *
 * Ref: https://docs.bitfinex.com/reference/rest-public-tickers
 */
export const BitfinexAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BitfinexAssetInfo = S.Schema.Type<typeof BitfinexAssetInfoSchema>;
