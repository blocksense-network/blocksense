import * as S from '@effect/schema/Schema';

/**
 * Schema for the relevant information about products received from BinanceTR Exchange.
 */
export const BinanceTRExchangeInfoRespSchema = S.mutable(
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

export type BinanceTRExchangeInfoResp = S.Schema.Type<
  typeof BinanceTRExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a BinanceTR Exchange oracle.
 *
 * Ref: https://www.binance.tr/apidocs/#change-log
 *      https://www.binance.tr/apidocs/#compressedaggregate-trades-list
 *      https://www.binance.tr/apidocs/#recent-trades-list
 */
export const BinanceTRExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceTRExchangeAssetInfo = S.Schema.Type<
  typeof BinanceTRExchangeAssetInfoSchema
>;
