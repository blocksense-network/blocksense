import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

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
 * Schema for the relevant information about products received from OKX Exchange.
 */
const OKXExchangeInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        instId: S.String,
        baseCcy: S.String,
        quoteCcy: S.String,
      }),
    ),
  }),
);

export type OKXExchangeInfoResp = S.Schema.Type<
  typeof OKXExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a OKX Exchange oracle.
 *
 * Ref: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-index-tickers
 */
const OKXExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    instId: S.String,
  }),
);

export type OKXExchangeAssetInfo = S.Schema.Type<
  typeof OKXExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from OKX Exchange.
 *
 * Ref: https://www.okx.com/docs-v5/en/#trading-account-rest-api-get-instruments
 */
export async function fetchOKXExchangeInfo(): Promise<OKXExchangeInfoResp> {
  const url = 'https://www.okx.com/api/v5/public/instruments?instType=SPOT';

  return fetchAndDecodeJSON(OKXExchangeInfoRespSchema, url);
}
