import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import { MEXCAssetInfo, MEXCInfoResp, MEXCInfoRespSchema } from './types';

/**
 * Class to fetch assets information from MEXC Exchange.
 */
export class MEXCAssetsFetcher implements ExchangeAssetsFetcher<MEXCAssetInfo> {
  async fetchAssets(): Promise<AssetInfo<MEXCAssetInfo>[]> {
    const assets = await fetchMEXCInfo();
    return assets.symbols.map(asset => ({
      pair: {
        base: asset.baseAsset,
        quote: asset.quoteAsset,
      },
      data: {
        symbol: asset.symbol,
      },
    }));
  }
}

/**
 * Function to fetch products information from MEXC Exchange.
 *
 * Ref: https://mexcdevelop.github.io/apidocs/spot_v3_en/#api-default-symbol
 */
export async function fetchMEXCInfo(): Promise<MEXCInfoResp> {
  const url = 'https://api.mexc.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(MEXCInfoRespSchema, url);
}
