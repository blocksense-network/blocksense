import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Binance oracle.
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints#symbol-price-ticker
 */
const BinanceAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type BinanceAssetInfo = typeof BinanceAssetInfoSchema.Type;

/**
 * Schema for the relevant information about symbols received from Binance.
 */
export const BinanceInfoRespSchema = S.mutable(
  S.Struct({
    symbols: S.mutable(
      S.Array(
        S.Struct({
          symbol: S.String,
          baseAsset: S.String,
          quoteAsset: S.String,
        }),
      ),
    ),
  }),
);

export type BinanceInfoResp = typeof BinanceInfoRespSchema.Type;

export const BinancePriceSchema = S.Array(
  S.mutable(
    S.Struct({
      symbol: S.String,
      lastPrice: S.String,
    }),
  ),
);

export type BinancePrice = typeof BinancePriceSchema.Type;
