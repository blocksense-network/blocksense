import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from MEXC Exchange.
 */
export class MEXCExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<MEXCExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<MEXCExchangeAssetInfo>[]> {
    const assets = await fetchMEXCExchangeInfo();
    return assets.symbols.map(asset => ({
      pair: {
        base: asset.baseAsset,
        quote: asset.quoteAsset,
      },
      data: {
        symbol: asset.symbol,
      },
    }));
  }
}

/**
 * Schema for the relevant information about products received from MEXC Exchange.
 */
const MEXCExchangeInfoRespSchema = S.mutable(
  S.Struct({
    symbols: S.Array(
      S.Struct({
        symbol: S.String,
        baseAsset: S.String,
        quoteAsset: S.String,
      }),
    ),
  }),
);

export type MEXCExchangeInfoResp = S.Schema.Type<
  typeof MEXCExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a MEXC Exchange oracle.
 *
 * Ref: https://mexcdevelop.github.io/apidocs/spot_v3_en/#symbol-price-ticker
 */
const MEXCExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type MEXCExchangeAssetInfo = S.Schema.Type<
  typeof MEXCExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from MEXC Exchange.
 *
 * Ref: https://mexcdevelop.github.io/apidocs/spot_v3_en/#api-default-symbol
 */
export async function fetchMEXCExchangeInfo(): Promise<MEXCExchangeInfoResp> {
  const url = 'https://api.mexc.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(MEXCExchangeInfoRespSchema, url);
}
