import * as S from '@effect/schema/Schema';

/**
 * Schema for the relevant information about products received from CryptoCom Exchange.
 */
export const CryptoComExchangeInfoRespSchema = S.mutable(
  S.Struct({
    result: S.Struct({
      data: S.Array(
        S.Struct({
          symbol: S.String,
          base_ccy: S.String,
          quote_ccy: S.String,
        }),
      ),
    }),
  }),
);

export type CryptoComExchangeInfoResp = S.Schema.Type<
  typeof CryptoComExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a CryptoCom Exchange oracle.
 *
 * Ref: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html#public-get-tickers
 */
const CryptoComExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    instrument_name: S.String,
  }),
);

export type CryptoComExchangeAssetInfo = S.Schema.Type<
  typeof CryptoComExchangeAssetInfoSchema
>;
