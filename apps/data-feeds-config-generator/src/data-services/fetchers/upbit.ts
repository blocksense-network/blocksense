import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../exchange-assets';

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
 * Schema for the market information received from Upbit.
 */
const UpbitMarketRespSchema = S.Array(
  S.Struct({
    market: S.String,
    korean_name: S.String,
    english_name: S.String,
  }),
);

export type UpbitMarketResp = S.Schema.Type<typeof UpbitMarketRespSchema>;

/**
 * Schema for the data relevant to a Upbit oracle.
 *
 * Ref: https://global-docs.upbit.com/docs/rest-api#1-market-information-and-ticker
 */
const UpbitAssetInfoSchema = S.mutable(
  S.Struct({
    market: S.String,
  }),
);

export type UpbitAssetInfo = S.Schema.Type<typeof UpbitAssetInfoSchema>;

/**
 * Function to fetch market information from Upbit.
 *
 * Ref: https://global-docs.upbit.com/reference/listing-market-list
 */
export async function fetchUpbitSymbolsInfo(): Promise<UpbitMarketResp> {
  const url = 'https://api.upbit.com/v1/market/all';

  return await fetchAndDecodeJSON(UpbitMarketRespSchema, url);
}
