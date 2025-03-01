import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BinanceAssetInfo,
  BinanceInfoResp,
  BinanceInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Binance.
 */
export class BinanceAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceAssetInfo>[]> {
    const assets = (await fetchBinanceSymbolsInfo()).symbols;
    return assets.map(asset => ({
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
 * Function to fetch symbols information from Binance.
 *
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/public-api-endpoints#exchange-information
 */
export async function fetchBinanceSymbolsInfo(): Promise<BinanceInfoResp> {
  const url = 'https://api.binance.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceInfoRespSchema, url);
}
