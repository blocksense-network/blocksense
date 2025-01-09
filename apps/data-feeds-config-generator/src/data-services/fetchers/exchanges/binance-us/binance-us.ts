import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BinanceUSExchangeAssetInfo,
  BinanceUSExchangeInfoResp,
  BinanceUSExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from BinanceUS Exchange.
 */
export class BinanceUSExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceUSExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceUSExchangeAssetInfo>[]> {
    const assets = await fetchBinanceUSExchangeInfo();
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
 * Function to fetch products information from BinanceUS Exchange.
 *
 * Ref: https://docs.binance.us/#get-system-status
 */
export async function fetchBinanceUSExchangeInfo(): Promise<BinanceUSExchangeInfoResp> {
  const url = 'https://api.binance.us/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceUSExchangeInfoRespSchema, url);
}
