import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  CoinbaseAssetInfo,
  CoinbaseInfoResp,
  CoinbaseInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Coinbase Exchange.
 */
export class CoinbaseAssetsFetcher
  implements ExchangeAssetsFetcher<CoinbaseAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<CoinbaseAssetInfo>[]> {
    const assets = await fetchCoinbaseInfo();
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
export async function fetchCoinbaseInfo(): Promise<CoinbaseInfoResp> {
  const url = 'https://api.exchange.coinbase.com/products';

  return fetchAndDecodeJSON(CoinbaseInfoRespSchema, url);
}
