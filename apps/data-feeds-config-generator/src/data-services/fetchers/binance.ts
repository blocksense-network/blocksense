import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

/**
 * Class to fetch assets information from Binance.
 */
export class BinanceAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceAssetInfo>[]> {
    const assets = (await fetchBinanceSymbolsInfo()).symbols;
    return assets.map(asset => ({
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
import { ExchangeAssetsFetcher, AssetInfo } from '../exchange-assets';

/**
 * Schema for the relevant information about symbols received from Binance.
 */
const BinanceExchangeInfoRespSchema = S.mutable(
  S.Struct({
    symbols: S.mutable(
      S.Array(
        S.Struct({
          symbol: S.String,
          baseAsset: S.String,
          quoteAsset: S.String,
        }),
      ),
    ),
  }),
);

export type BinanceExchangeInfoResp = S.Schema.Type<
  typeof BinanceExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a Binance oracle.
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/public-api-endpoints#symbol-price-ticker
 */
const BinanceAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceAssetInfo = S.Schema.Type<typeof BinanceAssetInfoSchema>;

/**
 * Function to fetch symbols information from Binance.
 *
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/public-api-endpoints#exchange-information
 */
export async function fetchBinanceSymbolsInfo(): Promise<BinanceExchangeInfoResp> {
  const url = 'https://api.binance.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceExchangeInfoRespSchema, url);
}
