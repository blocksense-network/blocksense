import { Schema as S } from 'effect';

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

export type BinanceInfoResp = S.Schema.Type<typeof BinanceInfoRespSchema>;

/**
 * Schema for the data relevant to a Binance oracle.
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints#symbol-price-ticker
 */
const BinanceAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceAssetInfo = S.Schema.Type<typeof BinanceAssetInfoSchema>;
