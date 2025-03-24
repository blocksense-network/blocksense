import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../../../exchange-assets';
import {
  UpbitAssetInfo,
  UpbitMarketResp,
  UpbitMarketRespSchema,
  UpbitPrice,
  UpbitPriceSchema,
} from './types';

/**
 * Class to fetch assets information from Upbit.
 */
export class UpbitAssetsFetcher
  implements ExchangeAssetsFetcher<UpbitAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<UpbitAssetInfo>[]> {
    const assets = await fetchUpbitSymbolsInfo();
    const prices = await fetchUpbitPricesInfo(
      assets.map(asset => asset.market),
    );
    return assets.map(asset => {
      const [quote, base] = asset.market.split('-');
      let price = prices.find(p => p.market === asset.market);
      if (!price) {
        console.warn(`[Upbit] Price not found for market: ${asset.market}`);
        price = { market: asset.market, trade_price: 0 };
      }

      return {
        pair: { base, quote },
        data: {
          market: asset.market,
          price: price.trade_price.toString(),
        },
      };
    });
  }
}

/**
 * Function to fetch market information from Upbit.
 *
 * Ref: https://global-docs.upbit.com/reference/listing-market-list
 */
export async function fetchUpbitSymbolsInfo(): Promise<UpbitMarketResp> {
  const url = 'https://api.upbit.com/v1/market/all';

  return await fetchAndDecodeJSON(UpbitMarketRespSchema, url);
}

export async function fetchUpbitPricesInfo(
  markets: string[],
): Promise<UpbitPrice> {
  const all_markets = markets.join(',');
  const url = `https://api.upbit.com/v1/ticker?markets=${all_markets}`;

  return await fetchAndDecodeJSON(UpbitPriceSchema, url);
}
