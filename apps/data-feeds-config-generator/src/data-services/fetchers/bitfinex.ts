import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

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
 * Schema for the relevant information about products received from Bitfinex Exchange.
 */
const BitfinexExchangeInfoRespSchema = S.mutable(S.Array(S.Array(S.String)));

export type BitfinexExchangeInfoResp = S.Schema.Type<
  typeof BitfinexExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a Bitfinex Exchange oracle.
 *
 * Ref: https://docs.bitfinex.com/reference/rest-public-tickers
 */
const BitfinexExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BitfinexExchangeAssetInfo = S.Schema.Type<
  typeof BitfinexExchangeAssetInfoSchema
>;

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
