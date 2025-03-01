import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import { BitgetAssetInfo, BitgetInfoResp, BitgetInfoRespSchema } from './types';

/**
 * Class to fetch assets information from Bitget Exchange.
 */
export class BitgetAssetsFetcher
  implements ExchangeAssetsFetcher<BitgetAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BitgetAssetInfo>[]> {
    const assets = await fetchBitgetInfo();
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
export async function fetchBitgetInfo(): Promise<BitgetInfoResp> {
  const url = 'https://api.bitget.com/api/spot/v1/public/products';

  return fetchAndDecodeJSON(BitgetInfoRespSchema, url);
}
