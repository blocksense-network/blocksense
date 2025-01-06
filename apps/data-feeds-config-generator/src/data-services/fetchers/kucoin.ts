import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from KuCoin Exchange.
 */
export class KuCoinExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<KuCoinExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<KuCoinExchangeAssetInfo>[]> {
    const assets = await fetchKuCoinExchangeInfo();
    return assets.data.map(asset => ({
      pair: {
        base: asset.baseCurrency,
        quote: asset.quoteCurrency,
      },
      data: {
        symbol: asset.symbol,
      },
    }));
  }
}

/**
 * Schema for the relevant information about products received from KuCoin Exchange.
 */
const KuCoinExchangeInfoRespSchema = S.mutable(
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

/**
 * Function to fetch products information from KuCoin Exchange.
 *
 * Ref: https://www.kucoin.com/docs/rest/spot-trading/market-data/get-symbols-list
 */
export async function fetchKuCoinExchangeInfo(): Promise<KuCoinExchangeInfoResp> {
  const url = 'https://api.kucoin.com/api/v2/symbols';

  return fetchAndDecodeJSON(KuCoinExchangeInfoRespSchema, url);
}
