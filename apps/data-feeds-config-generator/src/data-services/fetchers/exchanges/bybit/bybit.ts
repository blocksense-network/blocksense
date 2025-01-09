import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../../../exchange-assets';
import {
  BybitAssetInfo,
  BybitInstrumentsInfoResp,
  BybitInstrumentsInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from Bybit.
 */
export class BybitAssetsFetcher
  implements ExchangeAssetsFetcher<BybitAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BybitAssetInfo>[]> {
    const assets = (await fetchBybitSymbolsInfo()).result.list;
    return assets.map(asset => ({
      pair: {
        base: asset.baseCoin,
        quote: asset.quoteCoin,
      },
      data: {
        symbol: asset.symbol,
      },
    }));
  }
}

/**
 * Function to fetch information about symbols from Bybit.
 * Ref: https://bybit-exchange.github.io/docs/v5/market/instrument#http-request
 */
export async function fetchBybitSymbolsInfo(): Promise<BybitInstrumentsInfoResp> {
  const url = 'https://api.bybit.com/v5/market/instruments-info?category=spot';

  const data = await fetchAndDecodeJSON(BybitInstrumentsInfoRespSchema, url);

  if (data.retCode !== 0) {
    throw new Error(`Error: ${data.retCode} ${data.retMsg}`);
  }

  return data;
}
