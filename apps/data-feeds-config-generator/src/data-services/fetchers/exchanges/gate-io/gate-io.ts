import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';
import {
  GateIoAssetInfo,
  GateIoInfoResp,
  GateIoInfoRespSchema,
  GateIoPrice,
  GateIoPriceSchema,
} from './types';

/**
 * Class to fetch assets information from GateIo Exchange.
 */
export class GateIoAssetsFetcher
  implements ExchangeAssetsFetcher<GateIoAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<GateIoAssetInfo>[]> {
    const assets = await fetchGateIoInfo();
    const prices = await fetchGateIoPricesInfo();
    return assets.map(asset => {
      let price = prices.find(p => p.currency_pair === asset.id);
      if (!price) {
        console.warn(`[GateIo] Price not found for id: ${asset.id}`);
        price = { currency_pair: asset.id, last: '0' };
      }
      return {
        pair: { base: asset.base, quote: asset.quote },
        data: { id: asset.id, price: Number(price.last) },
      };
    });
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

export async function fetchGateIoPricesInfo(): Promise<GateIoPrice> {
  const url = `https://api.gateio.ws/api/v4/spot/tickers`;

  return fetchAndDecodeJSON(GateIoPriceSchema, url);
}
