import { Schema as S } from 'effect';

/**
 * Schema for the relevant information about products received from KuCoin Exchange.
 */
export const KuCoinExchangeInfoRespSchema = S.mutable(
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

export type KuCoinExchangeInfoResp = S.Schema.Type<
  typeof KuCoinExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a KuCoin Exchange oracle.
 *
 * Ref: https://www.kucoin.com/docs/rest/spot-trading/market-data/get-all-tickers
 */
const KuCoinExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type KuCoinExchangeAssetInfo = S.Schema.Type<
  typeof KuCoinExchangeAssetInfoSchema
>;
