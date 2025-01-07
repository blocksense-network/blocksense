import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from GateIo Exchange.
 */
export class GateIoExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<GateIoExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<GateIoExchangeAssetInfo>[]> {
    const assets = await fetchGateIoExchangeInfo();
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
 * Schema for the relevant information about products received from GateIo Exchange.
 */
const GateIoExchangeInfoRespSchema = S.mutable(
  S.Array(
    S.Struct({
      id: S.String,
      base: S.String,
      quote: S.String,
    }),
  ),
);

export type GateIoExchangeInfoResp = S.Schema.Type<
  typeof GateIoExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a GateIo Exchange oracle.
 *
 * Ref: https://www.gate.io/docs/developers/apiv4/en/#spot
 */
const GateIoExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.String,
  }),
);

export type GateIoExchangeAssetInfo = S.Schema.Type<
  typeof GateIoExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from GateIo Exchange.
 *
 * Ref: https://www.gate.io/docs/developers/apiv4/en/#get-details-of-a-specific-currency
 */
export async function fetchGateIoExchangeInfo(): Promise<GateIoExchangeInfoResp> {
  const url = 'https://api.gateio.ws/api/v4/spot/currency_pairs';

  return fetchAndDecodeJSON(GateIoExchangeInfoRespSchema, url);
}
