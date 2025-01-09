import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  GeminiExchangeAssetInfo,
  GeminiExchangeSymbolDetailsInfoResp,
  GeminiExchangeSymbolDetailsInfoRespSchema,
  GeminiExchangeSymbolsInfoResp,
  GeminiExchangeSymbolsInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Gemini Exchange.
 */
export class GeminiExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<GeminiExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<GeminiExchangeAssetInfo>[]> {
    const result: AssetInfo<GeminiExchangeAssetInfo>[] = [];
    const assets = await fetchGeminiExchangeSymbolsInfo();
    for (const asset of assets) {
      const assetDetails = await fetchGeminiExchangeSymbolDetailsInfo(asset);
      result.push({
        pair: {
          base: assetDetails.base_currency,
          quote: assetDetails.quote_currency,
        },
        data: {
          symbol: assetDetails.symbol,
        },
      });
    }
    return result;
  }
}

/**
 * Function to fetch symbols information from Gemini Exchange.
 *
 * Ref: https://docs.gemini.com/rest-api/#symbols
 */
export async function fetchGeminiExchangeSymbolsInfo(): Promise<GeminiExchangeSymbolsInfoResp> {
  const url = 'https://api.gemini.com/v1/symbols';

  return fetchAndDecodeJSON(GeminiExchangeSymbolsInfoRespSchema, url);
}

/**
 * Function to fetch symbol details information from Gemini Exchange.
 *
 * Ref: https://docs.gemini.com/rest-api/#symbol-details
 */
export async function fetchGeminiExchangeSymbolDetailsInfo(
  symbol: string,
): Promise<GeminiExchangeSymbolDetailsInfoResp> {
  const url = `https://api.gemini.com/v1/symbols/details/${symbol}`;

  return fetchAndDecodeJSON(GeminiExchangeSymbolDetailsInfoRespSchema, url);
}
