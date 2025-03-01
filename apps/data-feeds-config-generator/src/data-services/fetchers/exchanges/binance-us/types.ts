import { Schema as S } from 'effect';

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

export type BinanceUSInfoResp = S.Schema.Type<typeof BinanceUSInfoRespSchema>;

/**
 * Schema for the data relevant to a BinanceUS Exchange oracle.
 *
 * Ref: https://docs.binance.us/#get-live-ticker-price
 */
const BinanceUSAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceUSAssetInfo = S.Schema.Type<typeof BinanceUSAssetInfoSchema>;
