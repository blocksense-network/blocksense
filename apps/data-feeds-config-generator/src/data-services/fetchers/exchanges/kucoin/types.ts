import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a KuCoin Exchange oracle.
 *
 * Ref: https://www.kucoin.com/docs/rest/spot-trading/market-data/get-all-tickers
 */
const _KuCoinAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type KuCoinAssetInfo = typeof _KuCoinAssetInfoSchema.Type;

/**
 * Schema for the relevant information about products received from KuCoin Exchange.
 */
export const KuCoinInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        symbol: S.String,
        baseCurrency: S.String,
        quoteCurrency: S.String,
      }),
    ),
  }),
);

export type KuCoinInfoResp = typeof KuCoinInfoRespSchema.Type;

export const KuCoinPriceSchema = S.mutable(
  S.Struct({
    data: S.Struct({
      ticker: S.Array(
        S.Struct({
          symbol: S.String,
          last: S.NullishOr(S.String),
        }),
      ),
    }),
  }),
);

export type KuCoinPrice = typeof KuCoinPriceSchema.Type;
