import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

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
 * Schema for the relevant information about symbols received from Gemini Exchange.
 */
const GeminiExchangeSymbolsInfoRespSchema = S.mutable(S.Array(S.String));

export type GeminiExchangeSymbolsInfoResp = S.Schema.Type<
  typeof GeminiExchangeSymbolsInfoRespSchema
>;

/**
 * Schema for the relevant information about symbol details received from Gemini Exchange.
 */
const GeminiExchangeSymbolDetailsInfoRespSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    base_currency: S.String,
    quote_currency: S.String,
  }),
);

export type GeminiExchangeSymbolDetailsInfoResp = S.Schema.Type<
  typeof GeminiExchangeSymbolDetailsInfoRespSchema
>;

/**
 * Schema for the data relevant to a Gemini Exchange oracle.
 *
 * Ref: https://docs.gemini.com/rest-api/#ticker
 */
const GeminiExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type GeminiExchangeAssetInfo = S.Schema.Type<
  typeof GeminiExchangeAssetInfoSchema
>;

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
