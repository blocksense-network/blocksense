import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BinanceUSAssetInfo,
  BinanceUSInfoResp,
  BinanceUSInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from BinanceUS Exchange.
 */
export class BinanceUSAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceUSAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceUSAssetInfo>[]> {
    const assets = await fetchBinanceUSInfo();
    return assets.symbols
      .filter(asset => !asset.symbol.endsWith('USD'))
      .map(asset => ({
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
 * Function to fetch products information from BinanceUS Exchange.
 *
 * Ref: https://docs.binance.us/#get-system-status
 */
export async function fetchBinanceUSInfo(): Promise<BinanceUSInfoResp> {
  const url = 'https://api.binance.us/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceUSInfoRespSchema, url);
}
