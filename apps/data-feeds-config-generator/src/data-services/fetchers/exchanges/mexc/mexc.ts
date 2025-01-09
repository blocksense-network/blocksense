import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  MEXCExchangeAssetInfo,
  MEXCExchangeInfoResp,
  MEXCExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from MEXC Exchange.
 */
export class MEXCExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<MEXCExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<MEXCExchangeAssetInfo>[]> {
    const assets = await fetchMEXCExchangeInfo();
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
export async function fetchMEXCExchangeInfo(): Promise<MEXCExchangeInfoResp> {
  const url = 'https://api.mexc.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(MEXCExchangeInfoRespSchema, url);
}
