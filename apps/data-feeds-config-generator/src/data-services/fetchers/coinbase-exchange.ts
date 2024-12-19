import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from Coinbase Exchange.
 */
export class CoinbaseExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<CoinbaseExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<CoinbaseExchangeAssetInfo>[]> {
    const assets = await fetchCoinbaseExchangeInfo();
    return assets.map(asset => ({
      pair: {
        base: asset.base_currency,
        quote: asset.quote_currency,
      },
      data: {
        id: asset.id,
      },
    }));
  }
}

/**
 * Schema for the relevant information about products received from Coinbase Exchange.
 */
const CoinbaseExchangeInfoRespSchema = S.mutable(
  S.Array(
    S.Struct({
      id: S.String,
      base_currency: S.String,
      quote_currency: S.String,
    }),
  ),
);

export type CoinbaseExchangeInfoResp = S.Schema.Type<
  typeof CoinbaseExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a Coinbase Exchange oracle.
 *
 * Ref: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductticker
 */
const CoinbaseExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.String,
  }),
);

export type CoinbaseExchangeAssetInfo = S.Schema.Type<
  typeof CoinbaseExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from Coinbase Exchange.
 *
 * Ref: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducts
 */
export async function fetchCoinbaseExchangeInfo(): Promise<CoinbaseExchangeInfoResp> {
  const url = 'https://api.exchange.coinbase.com/products';

  return fetchAndDecodeJSON(CoinbaseExchangeInfoRespSchema, url);
}
