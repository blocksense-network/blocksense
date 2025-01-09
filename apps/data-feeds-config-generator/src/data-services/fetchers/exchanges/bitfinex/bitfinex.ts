import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  BitfinexExchangeAssetInfo,
  BitfinexExchangeInfoResp,
  BitfinexExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Bitfinex Exchange.
 */
export class BitfinexExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BitfinexExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BitfinexExchangeAssetInfo>[]> {
    const assets = await fetchBitfinexExchangeInfo();
    return assets[0].map(asset => {
      const pair = splitPair(asset);
      return {
        ...pair,
        data: {
          symbol: asset,
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
export async function fetchBitfinexExchangeInfo(): Promise<BitfinexExchangeInfoResp> {
  const url = 'https://api-pub.bitfinex.com/v2/conf/pub:list:pair:exchange';

  return fetchAndDecodeJSON(BitfinexExchangeInfoRespSchema, url);
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
      throw new Error('Unexpected format of pair recieved from Bitfinex');
    }
  }
}
