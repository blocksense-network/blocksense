import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from CryptoCom Exchange.
 */
export class CryptoComExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<CryptoComExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<CryptoComExchangeAssetInfo>[]> {
    const assets = await fetchCryptoComExchangeInfo();
    return assets.result.data.map(asset => ({
      pair: {
        base: asset.base_ccy,
        quote: asset.quote_ccy,
      },
      data: {
        instrument_name: asset.symbol,
      },
    }));
  }
}

/**
 * Schema for the relevant information about products received from CryptoCom Exchange.
 */
const CryptoComExchangeInfoRespSchema = S.mutable(
  S.Struct({
    result: S.Struct({
      data: S.Array(
        S.Struct({
          symbol: S.String,
          base_ccy: S.String,
          quote_ccy: S.String,
        }),
      ),
    }),
  }),
);

export type CryptoComExchangeInfoResp = S.Schema.Type<
  typeof CryptoComExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a CryptoCom Exchange oracle.
 *
 * Ref: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html#public-get-tickers
 */
const CryptoComExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    instrument_name: S.String,
  }),
);

export type CryptoComExchangeAssetInfo = S.Schema.Type<
  typeof CryptoComExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from CryptoCom Exchange.
 *
 * Ref: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html#public-get-instruments
 */
export async function fetchCryptoComExchangeInfo(): Promise<CryptoComExchangeInfoResp> {
  const url = 'https://api.crypto.com/exchange/v1/public/get-instruments';

  return fetchAndDecodeJSON(CryptoComExchangeInfoRespSchema, url);
}
