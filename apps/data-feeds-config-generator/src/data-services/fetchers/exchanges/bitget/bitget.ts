import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BitgetExchangeAssetInfo,
  BitgetExchangeInfoResp,
  BitgetExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Bitget Exchange.
 */
export class BitgetExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BitgetExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BitgetExchangeAssetInfo>[]> {
    const assets = await fetchBitgetExchangeInfo();
    return assets.data.map(asset => ({
      pair: {
        base: asset.baseCoin,
        quote: asset.quoteCoin,
      },
      data: {
        symbol: asset.symbol,
      },
    }));
  }
}

/**
 * Function to fetch products information from Bitget Exchange.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-symbols
 */
export async function fetchBitgetExchangeInfo(): Promise<BitgetExchangeInfoResp> {
  const url = 'https://api.bitget.com/api/spot/v1/public/products';

  return fetchAndDecodeJSON(BitgetExchangeInfoRespSchema, url);
}
