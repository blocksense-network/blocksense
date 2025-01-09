import * as S from '@effect/schema/Schema';

/**
 * Schema for the relevant information about products received from Bitget Exchange.
 */
export const BitgetExchangeInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        symbol: S.String,
        baseCoin: S.String,
        quoteCoin: S.String,
      }),
    ),
  }),
);

export type BitgetExchangeInfoResp = S.Schema.Type<
  typeof BitgetExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a Bitget Exchange oracle.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-all-tickers
 *      https://bitgetlimited.github.io/apidoc/en/spot/#get-single-ticker
 */
const BitgetExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BitgetExchangeAssetInfo = S.Schema.Type<
  typeof BitgetExchangeAssetInfoSchema
>;
