import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import type { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

import type { CoinbaseAssetInfo, CoinbaseInfoResp } from './types';
import { CoinbaseInfoRespSchema, CoinbasePriceSchema } from './types';

/**
 * Class to fetch assets information from Coinbase Exchange.
 */
export class CoinbaseAssetsFetcher
  implements ExchangeAssetsFetcher<CoinbaseAssetInfo>
{
  async fetchAssets(): Promise<Array<AssetInfo<CoinbaseAssetInfo>>> {
    const assets = (await fetchCoinbaseInfo()).filter(
      a => a.status === 'online',
    );
    const prices = await fetchCoinbasePricesInfo(assets.map(p => p.id));
    return assets.map(asset => {
      let price = prices.find(p => p.id === asset.id);
      if (!price) {
        console.warn(`[Coinbase] Price not found for symbol: ${asset.id}`);
        price = { id: asset.id, price: '0' };
      }
      return {
        pair: {
          base: asset.base_currency,
          quote: asset.quote_currency,
        },
        data: {
          id: asset.id,
          price: Number(price.price),
        },
      };
    });
  }
}

/**
 * Function to fetch products information from Coinbase Exchange.
 *
 * Ref: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducts
 */
export async function fetchCoinbaseInfo(): Promise<CoinbaseInfoResp> {
  const url = 'https://api.exchange.coinbase.com/products';

  return fetchAndDecodeJSON(CoinbaseInfoRespSchema, url);
}

export async function fetchCoinbasePricesInfo(
  allSymbols: string[],
): Promise<Array<{ id: string; price: string }>> {
  const prices = [];
  for (const symbol of allSymbols) {
    try {
      const url = `https://api.exchange.coinbase.com/products/${symbol}/ticker`;
      const response = await fetchAndDecodeJSON(CoinbasePriceSchema, url);
      prices.push({ id: symbol, price: response.price });
    } catch {
      console.warn(`[Coinbase] Error fetching price for symbol: ${symbol}`);
      prices.push({ id: symbol, price: '0' });
    }
  }
  return prices;
}
