import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from BinanceUS Exchange.
 */
export class BinanceUSExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceUSExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceUSExchangeAssetInfo>[]> {
    const assets = await fetchBinanceUSExchangeInfo();
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
 * Schema for the relevant information about products received from BinanceUS Exchange.
 */
const BinanceUSExchangeInfoRespSchema = S.mutable(
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

export type BinanceUSExchangeInfoResp = S.Schema.Type<
  typeof BinanceUSExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a BinanceUS Exchange oracle.
 *
 * Ref: https://docs.binance.us/#get-live-ticker-price
 */
const BinanceUSExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceUSExchangeAssetInfo = S.Schema.Type<
  typeof BinanceUSExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from BinanceUS Exchange.
 *
 * Ref: https://docs.binance.us/#get-system-status
 */
export async function fetchBinanceUSExchangeInfo(): Promise<BinanceUSExchangeInfoResp> {
  const url = 'https://api.binance.us/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceUSExchangeInfoRespSchema, url);
}
