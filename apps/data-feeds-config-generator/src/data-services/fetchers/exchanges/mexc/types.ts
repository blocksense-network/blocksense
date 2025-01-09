import { Schema as S } from 'effect';
/**
 * Schema for the relevant information about products received from MEXC Exchange.
 */
export const MEXCExchangeInfoRespSchema = S.mutable(
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

export type MEXCExchangeInfoResp = S.Schema.Type<
  typeof MEXCExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a MEXC Exchange oracle.
 *
 * Ref: https://mexcdevelop.github.io/apidocs/spot_v3_en/#symbol-price-ticker
 */
const MEXCExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type MEXCExchangeAssetInfo = S.Schema.Type<
  typeof MEXCExchangeAssetInfoSchema
>;
