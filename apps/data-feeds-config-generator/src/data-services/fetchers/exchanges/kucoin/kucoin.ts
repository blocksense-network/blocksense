import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  KuCoinAssetInfo,
  KuCoinInfoResp,
  KuCoinInfoRespSchema,
  KuCoinPrice,
  KuCoinPriceSchema,
} from './types';

/**
 * Class to fetch assets information from KuCoin Exchange.
 */
export class KuCoinAssetsFetcher
  implements ExchangeAssetsFetcher<KuCoinAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<KuCoinAssetInfo>[]> {
    const assets = (await fetchKuCoinInfo()).data;
    const prices = (await fetchKuCoinPricesInfo()).data.ticker;
    return assets.map(asset => {
      let price = prices.find(p => p.symbol === asset.symbol);
      if (!price || !price.last) {
        console.warn(`[KuCoin] Price not found for symbol: ${asset.symbol}`);
        price = { symbol: asset.symbol, last: '0' };
      }
      return {
        pair: {
          base: asset.baseCurrency,
          quote: asset.quoteCurrency,
        },
        data: {
          symbol: asset.symbol,
          price: price.last!,
        },
      };
    });
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

export async function fetchKuCoinPricesInfo(): Promise<KuCoinPrice> {
  const url = `https://api.kucoin.com/api/v1/market/allTickers`;

  return fetchAndDecodeJSON(KuCoinPriceSchema, url);
}
