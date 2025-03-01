import { Schema as S } from 'effect';

/**
 * Schema for the relevant information about products received from Bitget Exchange.
 */
export const BitgetInfoRespSchema = S.mutable(
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

export type BitgetInfoResp = S.Schema.Type<typeof BitgetInfoRespSchema>;

/**
 * Schema for the data relevant to a Bitget Exchange oracle.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-all-tickers
 *      https://bitgetlimited.github.io/apidoc/en/spot/#get-single-ticker
 */
const BitgetAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BitgetAssetInfo = S.Schema.Type<typeof BitgetAssetInfoSchema>;
