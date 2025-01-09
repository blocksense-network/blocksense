import { Schema as S } from 'effect';

/**
 * Schema for the relevant information about products received from BinanceUS Exchange.
 */
export const BinanceUSExchangeInfoRespSchema = S.mutable(
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

export type BinanceUSExchangeInfoResp = S.Schema.Type<
  typeof BinanceUSExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a BinanceUS Exchange oracle.
 *
 * Ref: https://docs.binance.us/#get-live-ticker-price
 */
const BinanceUSExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceUSExchangeAssetInfo = S.Schema.Type<
  typeof BinanceUSExchangeAssetInfoSchema
>;
