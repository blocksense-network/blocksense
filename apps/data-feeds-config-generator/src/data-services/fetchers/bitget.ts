import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from Bitget Exchange.
 */
export class BitgetExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BitgetExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BitgetExchangeAssetInfo>[]> {
    const assets = await fetchBitgetExchangeInfo();
    return assets.data.map(asset => ({
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
 * Schema for the relevant information about products received from Bitget Exchange.
 */
const BitgetExchangeInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Array(
      S.Struct({
        symbol: S.String,
        baseCoin: S.String,
        quoteCoin: S.String,
      }),
    ),
  }),
);

export type BitgetExchangeInfoResp = S.Schema.Type<
  typeof BitgetExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a Bitget Exchange oracle.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-all-tickers
 *      https://bitgetlimited.github.io/apidoc/en/spot/#get-single-ticker
 */
const BitgetExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BitgetExchangeAssetInfo = S.Schema.Type<
  typeof BitgetExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from Bitget Exchange.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-symbols
 */
export async function fetchBitgetExchangeInfo(): Promise<BitgetExchangeInfoResp> {
  const url = 'https://api.bitget.com/api/spot/v1/public/products';

  return fetchAndDecodeJSON(BitgetExchangeInfoRespSchema, url);
}
