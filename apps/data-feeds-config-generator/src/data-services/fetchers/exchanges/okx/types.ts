import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a OKX Exchange oracle.
 *
 * Ref: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-index-tickers
 */
const OKXAssetInfoSchema = S.mutable(
  S.Struct({
    instId: S.String,
    price: S.Number,
  }),
);

export type OKXAssetInfo = S.Schema.Type<typeof OKXAssetInfoSchema>;

/**
 * Schema for the relevant information about products received from OKX Exchange.
 */
export const OKXInfoRespSchema = S.mutable(
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

export type OKXInfoResp = S.Schema.Type<typeof OKXInfoRespSchema>;

export const OKXPriceSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        instId: S.String,
        last: S.String,
      }),
    ),
  }),
);

export type OKXPrice = S.Schema.Type<typeof OKXPriceSchema>;
