import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import {
  OKXExchangeAssetInfo,
  OKXExchangeInfoResp,
  OKXExchangeInfoRespSchema,
} from './types';

/**
 * Class to fetch assets information from OKX Exchange.
 */
export class OKXExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<OKXExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<OKXExchangeAssetInfo>[]> {
    const assets = await fetchOKXExchangeInfo();
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
export async function fetchOKXExchangeInfo(): Promise<OKXExchangeInfoResp> {
  const url = 'https://www.okx.com/api/v5/public/instruments?instType=SPOT';

  return fetchAndDecodeJSON(OKXExchangeInfoRespSchema, url);
}
