import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../../exchange-assets';
import { GateIoAssetInfo, GateIoInfoResp, GateIoInfoRespSchema } from './types';

/**
 * Class to fetch assets information from GateIo Exchange.
 */
export class GateIoAssetsFetcher
  implements ExchangeAssetsFetcher<GateIoAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<GateIoAssetInfo>[]> {
    const assets = await fetchGateIoInfo();
    return assets.map(asset => ({
      pair: {
        base: asset.base,
        quote: asset.quote,
      },
      data: {
        id: asset.id,
      },
    }));
  }
}

/**
 * Function to fetch products information from GateIo Exchange.
 *
 * Ref: https://www.gate.io/docs/developers/apiv4/en/#get-details-of-a-specific-currency
 */
export async function fetchGateIoInfo(): Promise<GateIoInfoResp> {
  const url = 'https://api.gateio.ws/api/v4/spot/currency_pairs';

  return fetchAndDecodeJSON(GateIoInfoRespSchema, url);
}
