import { Schema as S } from 'effect';

import { getEnvString } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchanges/exchange-assets';

/**
 * Class to fetch assets information from CoinMarketCap.
 */
export class CoinMarketCapAssetsFetcher
  implements ExchangeAssetsFetcher<CMCAssetInfo>
{
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

export const CMCMarketCapDataSchema = S.Struct({
  cmc_rank: S.Number,
  id: S.Number,
  symbol: S.String,
  name: S.String,
  quote: S.Struct({
    USD: S.Struct({
      market_cap: S.Number,
    }),
  }),
  market_cap_rank: S.NullishOr(S.Number),
});

export type CMCMarketCapData = S.Schema.Type<typeof CMCMarketCapDataSchema>;

export const CMCMarketCapDataResSchema = S.mutable(
  S.Array(CMCMarketCapDataSchema),
);

export type CMCMarketCapDataRes = S.Schema.Type<
  typeof CMCMarketCapDataResSchema
>;

export const CMCMarketCapDataRespSchema = S.mutable(
  S.Struct({
    data: S.mutable(S.Record({ key: S.String, value: CMCMarketCapDataSchema })),
  }),
);

type CMCMarketCapResp = S.Schema.Type<typeof CMCMarketCapDataRespSchema>;

async function fetchMarketCapData(ids: string[]): Promise<CMCMarketCapResp> {
  const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${ids.join(',')}`;

  const typedData = await fetchAndDecodeJSON(CMCMarketCapDataRespSchema, url, {
    headers: {
      'X-CMC_PRO_API_KEY': getEnvString('CMC_API_KEY'),
    },
  });

  return typedData;
}

export async function fetchAssetsInMarketCapOrder(): Promise<CMCMarketCapDataRes> {
  const BATCH_SIZE = 1000;

  const cmcData = await fetchCMCCryptoList();

  const ids = cmcData.data.map(coin => coin.id.toString());
  const chunks = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    chunks.push(ids.slice(i, i + BATCH_SIZE));
  }

  const marketCapDataPromises = chunks.map(chunk => fetchMarketCapData(chunk));
  const marketCapData = await Promise.all(marketCapDataPromises);

  const sortedMarketCapData = marketCapData
    .flatMap(data => Object.values(data.data))
    .sort((a, b) => b.quote.USD.market_cap - a.quote.USD.market_cap)
    .map((coin, index) => ({
      ...coin,
      market_cap_rank: index + 1,
    }));

  return sortedMarketCapData;
}
