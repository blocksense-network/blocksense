import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a BinanceTR Exchange oracle.
 *
 * Ref: https://www.binance.tr/apidocs/#change-log
 *      https://www.binance.tr/apidocs/#compressedaggregate-trades-list
 *      https://www.binance.tr/apidocs/#recent-trades-list
 */
export const BinanceTRAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceTRAssetInfo = S.Schema.Type<typeof BinanceTRAssetInfoSchema>;

/**
 * Schema for the relevant information about products received from BinanceTR Exchange.
 */
export const BinanceTRInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Struct({
      list: S.Array(
        S.Struct({
          symbol: S.String,
          baseAsset: S.String,
          quoteAsset: S.String,
        }),
      ),
    }),
  }),
);

export type BinanceTRInfoResp = S.Schema.Type<typeof BinanceTRInfoRespSchema>;
