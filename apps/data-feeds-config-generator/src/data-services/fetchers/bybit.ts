import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { ExchangeAssetsFetcher, AssetInfo } from '../exchange-assets';

/**
 * Class to fetch assets information from Bybit.
 */
export class BybitAssetsFetcher
  implements ExchangeAssetsFetcher<BybitAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BybitAssetInfo>[]> {
    const assets = (await fetchBybitSymbolsInfo()).result.list;
    return assets.map(asset => ({
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
 * Schema for the relevant information about symbols received from Bybit.
 */
const BybitInstrumentsInfoRespSchema = S.Struct({
  retCode: S.Number,
  retMsg: S.String,
  result: S.Struct({
    list: S.Array(
      S.Struct({
        symbol: S.String,
        baseCoin: S.String,
        quoteCoin: S.String,
      }),
    ),
  }),
});

export type BybitInstrumentsInfoResp = S.Schema.Type<
  typeof BybitInstrumentsInfoRespSchema
>;

/**
 * Schema for the data relevant to a Bybit oracle.
 *
 * Ref: https://bybit-exchange.github.io/docs/v5/market/tickers#request-parameters
 */
const BybitAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BybitAssetInfo = S.Schema.Type<typeof BybitAssetInfoSchema>;

/**
 * Function to decode Bybit symbol information.
 */
export const decodeBybitSymbolInfo = S.decodeUnknownSync(
  S.mutable(S.Array(BybitAssetInfoSchema)),
);

/**
 * Function to fetch information about symbols from Bybit.
 * Ref: https://bybit-exchange.github.io/docs/v5/market/instrument#http-request
 */
export async function fetchBybitSymbolsInfo(): Promise<BybitInstrumentsInfoResp> {
  const url = 'https://api.bybit.com/v5/market/instruments-info?category=spot';

  const data = await fetchAndDecodeJSON(BybitInstrumentsInfoRespSchema, url);

  if (data.retCode !== 0) {
    throw new Error(`Error: ${data.retCode} ${data.retMsg}`);
  }

  return data;
}
