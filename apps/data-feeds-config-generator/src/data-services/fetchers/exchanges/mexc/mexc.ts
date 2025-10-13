import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import type { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

import type { MEXCAssetInfo, MEXCInfoResp, MEXCPrice } from './types';
import { MEXCInfoRespSchema, MEXCPriceSchema } from './types';

/**
 * Class to fetch assets information from MEXC Exchange.
 */
export class MEXCAssetsFetcher implements ExchangeAssetsFetcher<MEXCAssetInfo> {
  async fetchAssets(): Promise<Array<AssetInfo<MEXCAssetInfo>>> {
    const assets = (await fetchMEXCInfo()).symbols;
    const prices = await fetchMEXCPricesInfo();
    return assets.map(asset => {
      let price = prices.find(p => p.symbol === asset.symbol);
      if (!price) {
        console.warn(`[MEXC] Price not found for symbol: ${asset.symbol}`);
        price = { symbol: asset.symbol, lastPrice: '0' };
      }
      return {
        pair: {
          base: asset.baseAsset,
          quote: asset.quoteAsset,
        },
        data: {
          symbol: asset.symbol,
          price: Number(price.lastPrice),
        },
      };
    });
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

export async function fetchMEXCPricesInfo(): Promise<MEXCPrice> {
  const url = `https://api.mexc.com/api/v3/ticker/24hr`;

  return fetchAndDecodeJSON(MEXCPriceSchema, url);
}
