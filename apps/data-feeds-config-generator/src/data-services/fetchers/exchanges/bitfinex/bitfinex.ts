import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import type { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

import type {
  BitfinexAssetInfo,
  BitfinexInfoResp,
  BitfinexPrice,
} from './types';
import { BitfinexInfoRespSchema, BitfinexPriceSchema } from './types';

/**
 * Class to fetch assets information from Bitfinex Exchange.
 */
export class BitfinexAssetsFetcher
  implements ExchangeAssetsFetcher<BitfinexAssetInfo>
{
  async fetchAssets(): Promise<Array<AssetInfo<BitfinexAssetInfo>>> {
    const assets = await fetchBitfinexInfo();
    const prices = await fetchBitfinexPricesInfo(assets[0]);
    return assets[0].map(asset => {
      const tickerAsset = `t${asset}`;
      const pair = splitPair(asset);
      let price = prices.find(p => p[0] === tickerAsset);
      if (!price) {
        console.warn(`[Bitfinex] Price not found for symbol: ${tickerAsset}`);
        price = [tickerAsset, '', '', '', '', '', '', 0];
      }
      return {
        pair: {
          base: pair.pair.base,
          quote: pair.pair.quote,
        },
        data: {
          symbol: tickerAsset,
          price: Number(price[7]),
        },
      };
    });
  }
}

/**
 * Function to fetch products information from Bitfinex Exchange.
 *
 * Ref: https://docs.bitfinex.com/reference/rest-public-conf
 */
export async function fetchBitfinexInfo(): Promise<BitfinexInfoResp> {
  const url = 'https://api-pub.bitfinex.com/v2/conf/pub:list:pair:exchange';

  return fetchAndDecodeJSON(BitfinexInfoRespSchema, url);
}

export function splitPair(pair: string): {
  pair: { base: string; quote: string };
} {
  if (pair.includes(':')) {
    const [base, quote] = pair.split(':');
    return { pair: { base, quote } };
  } else {
    if (pair.length === 6) {
      const base = pair.substring(0, 3);
      const quote = pair.substring(3);
      return { pair: { base, quote } };
    } else {
      throw new Error('Unexpected format of pair received from Bitfinex');
    }
  }
}

export async function fetchBitfinexPricesInfo(
  allSymbols: string[],
): Promise<BitfinexPrice> {
  const symbols = allSymbols.map(s => `t${s}`).join(',');
  const url = `https://api-pub.bitfinex.com/v2/tickers?symbols=${symbols}`;

  return fetchAndDecodeJSON(BitfinexPriceSchema, url);
}
