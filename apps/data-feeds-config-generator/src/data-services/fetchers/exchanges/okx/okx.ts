import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import { OKXAssetInfo, OKXInfoResp, OKXInfoRespSchema } from './types';

/**
 * Class to fetch assets information from OKX Exchange.
 */
export class OKXAssetsFetcher implements ExchangeAssetsFetcher<OKXAssetInfo> {
  async fetchAssets(): Promise<AssetInfo<OKXAssetInfo>[]> {
    const assets = await fetchOKXInfo();
    return assets.data.map(asset => ({
      pair: {
        base: asset.baseCcy,
        quote: asset.quoteCcy,
      },
      data: {
        instId: asset.instId,
      },
    }));
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
