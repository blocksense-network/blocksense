import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import type { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

import type {
  BybitAssetInfo,
  BybitInstrumentsInfoResp,
  BybitPrice,
} from './types';
import { BybitInstrumentsInfoRespSchema, BybitPriceSchema } from './types';

/**
 * Class to fetch assets information from Bybit.
 */
export class BybitAssetsFetcher
  implements ExchangeAssetsFetcher<BybitAssetInfo>
{
  async fetchAssets(): Promise<Array<AssetInfo<BybitAssetInfo>>> {
    const assets = (await fetchBybitSymbolsInfo()).result.list;
    const prices = (await fetchBybitPricesInfo()).result.list;
    return assets.map(asset => {
      let price = prices.find(p => p.symbol === asset.symbol);
      if (!price) {
        console.warn(`[Bybit] Price not found for symbol: ${asset.symbol}`);
        price = { symbol: asset.symbol, lastPrice: '0' };
      }
      return {
        pair: {
          base: asset.baseCoin,
          quote: asset.quoteCoin,
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
 * Function to fetch information about symbols from Bybit.
 * Ref: https://bybit-exchange.github.io/docs/v5/market/instrument#http-request
 */
export async function fetchBybitSymbolsInfo(): Promise<BybitInstrumentsInfoResp> {
  const url = 'https://api.bybit.com/v5/market/instruments-info?category=spot';

  const data = await fetchAndDecodeJSON(BybitInstrumentsInfoRespSchema, url);

  if (data.retCode !== 0) {
    throw new Error(`Error: ${data.retCode} ${data.retMsg}`);
  }

  return data;
}

export async function fetchBybitPricesInfo(): Promise<BybitPrice> {
  const url = `https://api.bybit.com/v5/market/tickers?category=spot`;

  return fetchAndDecodeJSON(BybitPriceSchema, url);
}
