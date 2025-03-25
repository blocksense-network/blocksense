import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Upbit oracle.
 *
 * Ref: https://global-docs.upbit.com/docs/rest-api#1-market-information-and-ticker
 */
const UpbitAssetInfoSchema = S.mutable(
  S.Struct({
    market: S.String,
    price: S.Number,
  }),
);

export type UpbitAssetInfo = S.Schema.Type<typeof UpbitAssetInfoSchema>;

/**
 * Schema for the market information received from Upbit.
 */
export const UpbitMarketRespSchema = S.Array(
  S.Struct({
    market: S.String,
    korean_name: S.String,
    english_name: S.String,
  }),
);

export type UpbitMarketResp = S.Schema.Type<typeof UpbitMarketRespSchema>;

export const UpbitPriceSchema = S.Array(
  S.mutable(
    S.Struct({
      market: S.String,
      trade_price: S.Number,
    }),
  ),
);

export type UpbitPrice = S.Schema.Type<typeof UpbitPriceSchema>;
