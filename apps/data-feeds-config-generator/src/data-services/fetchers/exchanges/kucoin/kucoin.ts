import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  KuCoinExchangeAssetInfo,
  KuCoinExchangeInfoResp,
  KuCoinExchangeInfoRespSchema,
} from './types';

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
 * Function to fetch products information from KuCoin Exchange.
 *
 * Ref: https://www.kucoin.com/docs/rest/spot-trading/market-data/get-symbols-list
 */
export async function fetchKuCoinExchangeInfo(): Promise<KuCoinExchangeInfoResp> {
  const url = 'https://api.kucoin.com/api/v2/symbols';

  return fetchAndDecodeJSON(KuCoinExchangeInfoRespSchema, url);
}
