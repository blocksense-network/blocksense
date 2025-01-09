import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  CoinbaseExchangeAssetInfo,
  CoinbaseExchangeInfoResp,
  CoinbaseExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Coinbase Exchange.
 */
export class CoinbaseExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<CoinbaseExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<CoinbaseExchangeAssetInfo>[]> {
    const assets = await fetchCoinbaseExchangeInfo();
    return assets.map(asset => ({
      pair: {
        base: asset.base_currency,
        quote: asset.quote_currency,
      },
      data: {
        id: asset.id,
      },
    }));
  }
}

/**
 * Function to fetch products information from Coinbase Exchange.
 *
 * Ref: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducts
 */
export async function fetchCoinbaseExchangeInfo(): Promise<CoinbaseExchangeInfoResp> {
  const url = 'https://api.exchange.coinbase.com/products';

  return fetchAndDecodeJSON(CoinbaseExchangeInfoRespSchema, url);
}
