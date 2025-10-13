import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a BinanceUS Exchange oracle.
 *
 * Ref: https://docs.binance.us/#get-live-ticker-price
 */
const _BinanceUSAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type BinanceUSAssetInfo = typeof _BinanceUSAssetInfoSchema.Type;

/**
 * Schema for the relevant information about products received from BinanceUS Exchange.
 */
export const BinanceUSInfoRespSchema = S.mutable(
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

export type BinanceUSInfoResp = typeof BinanceUSInfoRespSchema.Type;

export const BinanceUSPriceSchema = S.Array(
  S.mutable(
    S.Struct({
      symbol: S.String,
      lastPrice: S.String,
    }),
  ),
);

export type BinanceUSPrice = typeof BinanceUSPriceSchema.Type;
