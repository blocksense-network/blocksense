import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BinanceAssetInfo,
  BinanceInfoResp,
  BinanceInfoRespSchema,
  BinancePrice,
  BinancePriceSchema,
} from './types';

/**
 * Class to fetch assets information from Binance.
 */
export class BinanceAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceAssetInfo>[]> {
    const assets = (await fetchBinanceSymbolsInfo()).symbols;
    const prices = await fetchBinancePricesInfo();
    return assets.map(asset => {
      let price = prices.find(p => p.symbol === asset.symbol);
      if (!price) {
        console.warn(`[Binance] Price not found for symbol: ${asset.symbol}`);
        price = { symbol: asset.symbol, lastPrice: '0' };
      }
      return {
        pair: {
          base: asset.baseAsset,
          quote: asset.quoteAsset,
        },
        data: {
          symbol: asset.symbol,
          price: price?.lastPrice,
        },
      };
    });
  }
}

/**
 * Function to fetch symbols information from Binance.
 *
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/general-endpoints#exchange-information
 */
export async function fetchBinanceSymbolsInfo(): Promise<BinanceInfoResp> {
  const url = 'https://api.binance.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceInfoRespSchema, url);
}

export async function fetchBinancePricesInfo(): Promise<BinancePrice> {
  const url = `https://api1.binance.com/api/v3/ticker/24hr`;

  return fetchAndDecodeJSON(BinancePriceSchema, url);
}
