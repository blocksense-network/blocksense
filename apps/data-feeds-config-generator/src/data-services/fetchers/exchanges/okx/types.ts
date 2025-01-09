import * as S from '@effect/schema/Schema';

/**
 * Schema for the relevant information about products received from OKX Exchange.
 */
export const OKXExchangeInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        instId: S.String,
        baseCcy: S.String,
        quoteCcy: S.String,
      }),
    ),
  }),
);

export type OKXExchangeInfoResp = S.Schema.Type<
  typeof OKXExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a OKX Exchange oracle.
 *
 * Ref: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-index-tickers
 */
const OKXExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    instId: S.String,
  }),
);

export type OKXExchangeAssetInfo = S.Schema.Type<
  typeof OKXExchangeAssetInfoSchema
>;
