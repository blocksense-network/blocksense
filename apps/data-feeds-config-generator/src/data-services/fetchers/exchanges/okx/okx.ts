import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  OKXAssetInfo,
  OKXInfoResp,
  OKXInfoRespSchema,
  OKXPrice,
  OKXPriceSchema,
} from './types';

/**
 * Class to fetch assets information from OKX Exchange.
 */
export class OKXAssetsFetcher implements ExchangeAssetsFetcher<OKXAssetInfo> {
  async fetchAssets(): Promise<AssetInfo<OKXAssetInfo>[]> {
    const assets = (await fetchOKXInfo()).data;
    const prices = (await fetchOKXPricesInfo()).data;
    return assets.map(asset => {
      let price = prices.find(p => p.instId === asset.instId);
      if (!price) {
        console.warn(`[OKX] Price not found for instId: ${asset.instId}`);
        price = { instId: asset.instId, last: '0' };
      }
      return {
        pair: { base: asset.baseCcy, quote: asset.quoteCcy },
        data: { instId: asset.instId, price: price.last },
      };
    });
  }
}

/**
 * Function to fetch products information from OKX Exchange.
 *
 * Ref: https://www.okx.com/docs-v5/en/#trading-account-rest-api-get-instruments
 */
export async function fetchOKXInfo(): Promise<OKXInfoResp> {
  const url = 'https://www.okx.com/api/v5/public/instruments?instType=SPOT';

  return fetchAndDecodeJSON(OKXInfoRespSchema, url);
}

export async function fetchOKXPricesInfo(): Promise<OKXPrice> {
  const url = 'https://www.okx.com/api/v5/market/tickers?instType=SPOT';

  return fetchAndDecodeJSON(OKXPriceSchema, url);
}
