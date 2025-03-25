import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a CryptoCom Exchange oracle.
 *
 * Ref: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html#public-get-tickers
 */
const CryptoComAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type CryptoComAssetInfo = S.Schema.Type<typeof CryptoComAssetInfoSchema>;

/**
 * Schema for the relevant information about products received from CryptoCom Exchange.
 */
export const CryptoComInfoRespSchema = S.mutable(
  S.Struct({
    result: S.Struct({
      data: S.Array(
        S.Struct({
          symbol: S.String,
          base_ccy: S.String,
          quote_ccy: S.String,
          inst_type: S.String,
        }),
      ),
    }),
  }),
);

export type CryptoComInfoResp = S.Schema.Type<typeof CryptoComInfoRespSchema>;

export const CryptoComPriceSchema = S.mutable(
  S.Struct({
    result: S.Struct({
      data: S.Array(
        S.mutable(
          S.Struct({
            i: S.String,
            a: S.String,
          }),
        ),
      ),
    }),
  }),
);

export type CryptoComPrice = S.Schema.Type<typeof CryptoComPriceSchema>;
