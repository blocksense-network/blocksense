import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a MEXC Exchange oracle.
 *
 * Ref: https://mexcdevelop.github.io/apidocs/spot_v3_en/#symbol-price-ticker
 */
const MEXCAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type MEXCAssetInfo = typeof MEXCAssetInfoSchema.Type;

/**
 * Schema for the relevant information about products received from MEXC Exchange.
 */
export const MEXCInfoRespSchema = S.mutable(
  S.Struct({
    symbols: S.Array(
      S.Struct({
        symbol: S.String,
        baseAsset: S.String,
        quoteAsset: S.String,
      }),
    ),
  }),
);

export type MEXCInfoResp = typeof MEXCInfoRespSchema.Type;

export const MEXCPriceSchema = S.Array(
  S.mutable(
    S.Struct({
      symbol: S.String,
      lastPrice: S.String,
    }),
  ),
);

export type MEXCPrice = typeof MEXCPriceSchema.Type;
