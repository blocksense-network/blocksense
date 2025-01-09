import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  CryptoComExchangeAssetInfo,
  CryptoComExchangeInfoResp,
  CryptoComExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from CryptoCom Exchange.
 */
export class CryptoComExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<CryptoComExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<CryptoComExchangeAssetInfo>[]> {
    const assets = await fetchCryptoComExchangeInfo();
    return assets.result.data.map(asset => ({
      pair: {
        base: asset.base_ccy,
        quote: asset.quote_ccy,
      },
      data: {
        instrument_name: asset.symbol,
      },
    }));
  }
}

/**
 * Function to fetch products information from CryptoCom Exchange.
 *
 * Ref: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html#public-get-instruments
 */
export async function fetchCryptoComExchangeInfo(): Promise<CryptoComExchangeInfoResp> {
  const url = 'https://api.crypto.com/exchange/v1/public/get-instruments';

  return fetchAndDecodeJSON(CryptoComExchangeInfoRespSchema, url);
}
