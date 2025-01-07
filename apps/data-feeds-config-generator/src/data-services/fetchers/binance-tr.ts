import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';

/**
 * Class to fetch assets information from BinanceTR Exchange.
 */
export class BinanceTRExchangeAssetsFetcher
  implements ExchangeAssetsFetcher<BinanceTRExchangeAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BinanceTRExchangeAssetInfo>[]> {
    const assets = await fetchBinanceTRExchangeInfo();
    return assets.data.list.map(asset => ({
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
 * Schema for the relevant information about products received from BinanceTR Exchange.
 */
const BinanceTRExchangeInfoRespSchema = S.mutable(
  S.Struct({
    data: S.Struct({
      list: S.Array(
        S.Struct({
          symbol: S.String,
          baseAsset: S.String,
          quoteAsset: S.String,
        }),
      ),
    }),
  }),
);

export type BinanceTRExchangeInfoResp = S.Schema.Type<
  typeof BinanceTRExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a BinanceTR Exchange oracle.
 *
 * Ref: https://www.binance.tr/apidocs/#change-log
 *      https://www.binance.tr/apidocs/#compressedaggregate-trades-list
 *      https://www.binance.tr/apidocs/#recent-trades-list
 */
const BinanceTRExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BinanceTRExchangeAssetInfo = S.Schema.Type<
  typeof BinanceTRExchangeAssetInfoSchema
>;

/**
 * Function to fetch products information from BinanceTR Exchange.
 *
 * Ref: https://www.binance.tr/apidocs/#get-all-supported-trading-symbol
 */
export async function fetchBinanceTRExchangeInfo(): Promise<BinanceTRExchangeInfoResp> {
  const url = 'https://www.binance.tr/open/v1/common/symbols';

  return fetchAndDecodeJSON(BinanceTRExchangeInfoRespSchema, url);
}
