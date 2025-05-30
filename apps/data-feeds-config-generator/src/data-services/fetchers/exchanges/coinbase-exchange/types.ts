import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Coinbase Exchange oracle.
 *
 * Ref: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductticker
 */
const CoinbaseAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.String,
    price: S.Number,
  }),
);

export type CoinbaseAssetInfo = typeof CoinbaseAssetInfoSchema.Type;

/**
 * Schema for the relevant information about products received from Coinbase Exchange.
 */
export const CoinbaseInfoRespSchema = S.mutable(
  S.Array(
    S.Struct({
      id: S.String,
      base_currency: S.String,
      quote_currency: S.String,
      status: S.String,
    }),
  ),
);

export type CoinbaseInfoResp = typeof CoinbaseInfoRespSchema.Type;

export const CoinbasePriceSchema = S.Struct({
  price: S.String,
});

export type CoinbasePrice = typeof CoinbasePriceSchema.Type;
