import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BinanceUSAssetInfo,
  BinanceUSInfoResp,
  BinanceUSInfoRespSchema,
  BinanceUSPrice,
  BinanceUSPriceSchema,
} from './types';

/**
 * Class to fetch assets information from BinanceUS Exchange.
 */
export class BinanceUSAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceUSAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceUSAssetInfo>[]> {
    const assets = (await fetchBinanceUSInfo()).symbols;
    const prices = await fetchBinanceUSPricesInfo();
    return assets.map(asset => {
      let price = prices.find(p => p.symbol === asset.symbol);
      if (!price) {
        console.warn(`[BinanceUS] Price not found for symbol: ${asset.symbol}`);
        price = { symbol: asset.symbol, lastPrice: '0' };
      }
      return {
        pair: {
          base: asset.baseAsset,
          quote: asset.quoteAsset,
        },
        data: {
          symbol: asset.symbol,
          price: price.lastPrice,
        },
      };
    });
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

export async function fetchBinanceUSPricesInfo(): Promise<BinanceUSPrice> {
  const url = `https://api.binance.us/api/v3/ticker/24hr`;

  return fetchAndDecodeJSON(BinanceUSPriceSchema, url);
}
