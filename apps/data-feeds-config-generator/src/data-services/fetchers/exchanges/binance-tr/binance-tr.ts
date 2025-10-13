import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import type { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

import type { BinanceTRAssetInfo, BinanceTRInfoResp } from './types';
import { BinanceTRInfoRespSchema } from './types';

/**
 * Class to fetch assets information from BinanceTR Exchange.
 */
export class BinanceTRAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceTRAssetInfo>
{
  async fetchAssets(): Promise<Array<AssetInfo<BinanceTRAssetInfo>>> {
    const assets = await fetchBinanceTRInfo();
    return assets.data.list.map(asset => ({
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
 * Function to fetch products information from BinanceTR Exchange.
 *
 * Ref: https://www.binance.tr/apidocs/#get-all-supported-trading-symbol
 */
export async function fetchBinanceTRInfo(): Promise<BinanceTRInfoResp> {
  const url = 'https://www.binance.tr/open/v1/common/symbols';

  return fetchAndDecodeJSON(BinanceTRInfoRespSchema, url);
}
