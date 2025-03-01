import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import { KuCoinAssetInfo, KuCoinInfoResp, KuCoinInfoRespSchema } from './types';

/**
 * Class to fetch assets information from KuCoin Exchange.
 */
export class KuCoinAssetsFetcher
  implements ExchangeAssetsFetcher<KuCoinAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<KuCoinAssetInfo>[]> {
    const assets = await fetchKuCoinInfo();
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
export async function fetchKuCoinInfo(): Promise<KuCoinInfoResp> {
  const url = 'https://api.kucoin.com/api/v2/symbols';

  return fetchAndDecodeJSON(KuCoinInfoRespSchema, url);
}
