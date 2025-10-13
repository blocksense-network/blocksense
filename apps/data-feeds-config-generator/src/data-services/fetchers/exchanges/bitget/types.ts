import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Bitget Exchange oracle.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-all-tickers
 *      https://bitgetlimited.github.io/apidoc/en/spot/#get-single-ticker
 */
const _BitgetAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type BitgetAssetInfo = typeof _BitgetAssetInfoSchema.Type;

/**
 * Schema for the relevant information about products received from Bitget Exchange.
 */
export const BitgetInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        symbolName: S.String,
        baseCoin: S.String,
        quoteCoin: S.String,
      }),
    ),
  }),
);

export type BitgetInfoResp = typeof BitgetInfoRespSchema.Type;

export const BitgetPriceSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.mutable(
        S.Struct({
          symbol: S.String,
          close: S.String,
        }),
      ),
    ),
  }),
);

export type BitgetPrice = typeof BitgetPriceSchema.Type;
