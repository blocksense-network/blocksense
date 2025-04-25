import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a KuCoin Exchange oracle.
 *
 * Ref: https://www.kucoin.com/docs/rest/spot-trading/market-data/get-all-tickers
 */
const KuCoinAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type KuCoinAssetInfo = S.Schema.Type<typeof KuCoinAssetInfoSchema>;

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

export type KuCoinInfoResp = S.Schema.Type<typeof KuCoinInfoRespSchema>;

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

export type KuCoinPrice = S.Schema.Type<typeof KuCoinPriceSchema>;
