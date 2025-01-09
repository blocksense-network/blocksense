import * as S from '@effect/schema/Schema';

import { getEnvString } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../../exchange-assets';

/**
 * Class to fetch assets information from CoinMarketCap.
 */
export class CMCAssetFetcher implements ExchangeAssetsFetcher<CMCAssetInfo> {
  async fetchAssets(): Promise<AssetInfo<CMCAssetInfo>[]> {
    const assets = (await fetchCMCCryptoList()).data;
    return assets.map(asset => ({
      pair: {
        base: asset.symbol,
        quote: 'USD',
      },
      data: {
        symbol: asset.symbol,
        id: asset.id,
      },
    }));
  }
}

export const CMCInfoSchema = S.Struct({
  id: S.Number,
  rank: S.Number,
  name: S.String,
  symbol: S.String,
  slug: S.String,
  is_active: S.Number,
  first_historical_data: S.NullishOr(S.Date),
  last_historical_data: S.NullishOr(S.Date),
  platform: S.NullishOr(
    S.Struct({
      id: S.Number,
      name: S.String,
      symbol: S.String,
      slug: S.String,
      token_address: S.String,
    }),
  ),
}).annotations({ identifier: 'CMCInfo' });

export type CMCInfo = S.Schema.Type<typeof CMCInfoSchema>;

/**
 * Function to decode CoinMarketCap information.
 */
export const decodeCMCInfo = S.decodeUnknownSync(S.Array(CMCInfoSchema));

export async function getCMCCryptoList(): Promise<readonly CMCInfo[]> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';

  const t = S.Struct({
    data: S.Array(CMCInfoSchema),
  });

  const typedData = await fetchAndDecodeJSON(t, url, {
    headers: {
      'X-CMC_PRO_API_KEY': getEnvString('CMC_API_KEY'),
    },
  });

  return typedData.data;
}

/**
 * Schema for the information about currencies received from CoinMarketCap.
 */
export const CMCInfoRespSchema = S.mutable(
  S.Struct({
    data: S.mutable(S.Array(CMCInfoSchema)),
  }),
);

export type CMCInfoResp = S.Schema.Type<typeof CMCInfoRespSchema>;

/**
 * Schema for the data relevant to a CoinMarketCap oracle.
 *
 * Ref: https://coinmarketcap.com/api/documentation/v1/#operation/getV2CryptocurrencyQuotesLatest
 */
const CMCAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.Number,
    symbol: S.String,
  }),
);

export type CMCAssetInfo = S.Schema.Type<typeof CMCAssetInfoSchema>;

/**
 * Function to decode CoinMarketCap symbol information.
 * Ref: https://coinmarketcap.com/api/documentation/v1/#operation/getV1CryptocurrencyMap
 */
export async function fetchCMCCryptoList(): Promise<CMCInfoResp> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';

  const typedData = await fetchAndDecodeJSON(CMCInfoRespSchema, url, {
    headers: {
      'X-CMC_PRO_API_KEY': getEnvString('CMC_API_KEY'),
    },
  });

  return typedData;
}
