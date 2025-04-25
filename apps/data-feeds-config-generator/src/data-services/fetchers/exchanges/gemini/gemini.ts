import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  GeminiAssetInfo,
  GeminiSymbolDetailsInfoResp,
  GeminiSymbolDetailsInfoRespSchema,
  GeminiSymbolsInfoResp,
  GeminiSymbolsInfoRespSchema,
  GeminiPrice,
  GeminiPriceSchema,
} from './types';

/**
 * Class to fetch assets information from Gemini Exchange.
 */
export class GeminiAssetsFetcher
  implements ExchangeAssetsFetcher<GeminiAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<GeminiAssetInfo>[]> {
    const result: AssetInfo<GeminiAssetInfo>[] = [];
    const assets = await fetchGeminiSymbolsInfo();
    for (const asset of assets) {
      const assetDetails = await fetchGeminiSymbolDetailsInfo(asset);
      const price = await fetchGeminiPriceInfo(asset);
      result.push({
        pair: {
          base: assetDetails.base_currency,
          quote: assetDetails.quote_currency,
        },
        data: {
          symbol: assetDetails.symbol,
          price: Number(price.last),
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
export async function fetchGeminiSymbolsInfo(): Promise<GeminiSymbolsInfoResp> {
  const url = 'https://api.gemini.com/v1/symbols';

  return fetchAndDecodeJSON(GeminiSymbolsInfoRespSchema, url);
}

/**
 * Function to fetch symbol details information from Gemini Exchange.
 *
 * Ref: https://docs.gemini.com/rest-api/#symbol-details
 */
export async function fetchGeminiSymbolDetailsInfo(
  symbol: string,
): Promise<GeminiSymbolDetailsInfoResp> {
  const url = `https://api.gemini.com/v1/symbols/details/${symbol}`;

  return fetchAndDecodeJSON(GeminiSymbolDetailsInfoRespSchema, url);
}

export async function fetchGeminiPriceInfo(
  symbol: string,
): Promise<{ id: string; last: string }> {
  try {
    const url = `https://api.gemini.com/v1/pubticker/${symbol}`;
    const response = await fetchAndDecodeJSON(GeminiPriceSchema, url);
    return { id: symbol, last: response.last };
  } catch (error) {
    console.error(`[Gemini] Error fetching prices: ${error}`);
    return { id: symbol, last: '0' };
  }
}
