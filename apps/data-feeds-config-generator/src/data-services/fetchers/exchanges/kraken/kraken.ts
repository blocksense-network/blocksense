import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../../../exchange-assets';
import {
  KrakenAssetInfo,
  KrakenAssetPairsResp,
  KrakenAssetPairsRespSchema,
  KrakenAssetRespSchema,
} from './types';

/**
 * Class to fetch assets information from Kraken.
 */
export class KrakenAssetsFetcher
  implements ExchangeAssetsFetcher<KrakenAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<KrakenAssetInfo>[]> {
    const assetsUrl = 'https://api.kraken.com/0/public/Assets';
    const assetsData = await fetchAndDecodeJSON(
      KrakenAssetRespSchema,
      assetsUrl,
    );

    const assets = (await fetchKrakenSymbolsInfo()).result;
    return Object.entries(assets).map(([key, value]) => ({
      pair: {
        // https://support.kraken.com/hc/en-us/articles/360000920306-API-symbols-and-tickers
        // Use the altname to get the actual asset name
        base: assetsData.result[value.base].altname,
        quote: assetsData.result[value.quote].altname,
      },
      data: {
        pair: key,
        wsname: value.wsname,
      },
    }));
  }
}

/**
 * Function to fetch detailed information about symbols from Kraken.
 *
 * Ref: https://docs.kraken.com/api/docs/rest-api/get-tradable-asset-pairs
 */
export async function fetchKrakenSymbolsInfo(): Promise<KrakenAssetPairsResp> {
  const url = 'https://api.kraken.com/0/public/AssetPairs';

  const pairsData = await fetchAndDecodeJSON(KrakenAssetPairsRespSchema, url);

  if (pairsData.error.length > 0) {
    throw new Error(`Found errors in paris data: ${pairsData.error}`);
  }

  return pairsData;
}
