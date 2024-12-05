import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../exchange-assets';

/**
 * Class to fetch assets information from Kraken.
 */
export class KrakenAssetsFetcher
  implements ExchangeAssetsFetcher<KrakenAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<KrakenAssetInfo>[]> {
    const assetsUrl = 'https://api.kraken.com/0/public/Assets';
    const assetsData = await fetchAndDecodeJSON(
      KrakenAssetRespSchema,
      assetsUrl,
    );

    const assets = (await fetchKrakenSymbolsInfo()).result;
    return Object.entries(assets).map(([key, value]) => ({
      pair: {
        // https://support.kraken.com/hc/en-us/articles/360000920306-API-symbols-and-tickers
        // Use the altname to get the actual asset name
        base: assetsData.result[value.base].altname,
        quote: assetsData.result[value.quote].altname,
      },
      data: {
        pair: key,
        wsname: value.wsname,
      },
    }));
  }
}

/**
 * Schema for the relevant information about assets received from Kraken.
 */
const KrakenAssetPairsRespSchema = S.Struct({
  error: S.Array(S.Any),
  result: S.Record({
    key: S.String,
    value: S.mutable(
      S.Struct({
        altname: S.String,
        wsname: S.String,
        base: S.String,
        quote: S.String,
      }),
    ),
  }),
});

type KrakenAssetPairsResp = S.Schema.Type<typeof KrakenAssetPairsRespSchema>;

const KrakenAssetRespSchema = S.Struct({
  error: S.Array(S.Any),
  result: S.Record({
    key: S.String,
    value: S.Struct({
      altname: S.String,
    }),
  }),
});

/**
 * Schema for the data relevant to a Kraken oracle.
 *
 * Ref: https://docs.kraken.com/api/docs/rest-api/get-ticker-information/
 * Ref: https://docs.kraken.com/api/docs/websocket-v2/ticker ( note that wsname match with symbol in their doc
 */
const KrakenAssetInfoSchema = S.mutable(
  S.Struct({
    pair: S.String,
    wsname: S.String,
  }),
);

/**
 * Type for the information about symbols received from Kraken.
 */
export type KrakenAssetInfo = S.Schema.Type<typeof KrakenAssetInfoSchema>;

/**
 * Function to fetch detailed information about symbols from Kraken.
 *
 * Ref: https://docs.kraken.com/api/docs/rest-api/get-tradable-asset-pairs
 */
export async function fetchKrakenSymbolsInfo(): Promise<KrakenAssetPairsResp> {
  const url = 'https://api.kraken.com/0/public/AssetPairs';

  const pairsData = await fetchAndDecodeJSON(KrakenAssetPairsRespSchema, url);

  if (pairsData.error.length > 0) {
    throw new Error(`Found errors in paris data: ${pairsData.error}`);
  }

  return pairsData;
}
