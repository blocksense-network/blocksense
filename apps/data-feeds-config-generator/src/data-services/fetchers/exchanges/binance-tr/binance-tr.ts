import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BinanceTRExchangeAssetInfo,
  BinanceTRExchangeInfoResp,
  BinanceTRExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from BinanceTR Exchange.
 */
export class BinanceTRExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceTRExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceTRExchangeAssetInfo>[]> {
    const assets = await fetchBinanceTRExchangeInfo();
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
export async function fetchBinanceTRExchangeInfo(): Promise<BinanceTRExchangeInfoResp> {
  const url = 'https://www.binance.tr/open/v1/common/symbols';

  return fetchAndDecodeJSON(BinanceTRExchangeInfoRespSchema, url);
}
