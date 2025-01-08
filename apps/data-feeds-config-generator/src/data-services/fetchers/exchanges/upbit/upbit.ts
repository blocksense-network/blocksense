import { Schema as S } from 'effect';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../../../exchange-assets';
import {
  UpbitAssetInfo,
  UpbitMarketResp,
  UpbitMarketRespSchema,
} from './types';

/**
 * Class to fetch assets information from Upbit.
 */
export class UpbitAssetsFetcher
  implements ExchangeAssetsFetcher<UpbitAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<UpbitAssetInfo>[]> {
    const assets = await fetchUpbitSymbolsInfo();
    return assets.map(asset => {
      const [quote, base] = asset.market.split('-');

      return {
        pair: {
          base,
          quote,
        },
        data: {
          market: asset.market,
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
