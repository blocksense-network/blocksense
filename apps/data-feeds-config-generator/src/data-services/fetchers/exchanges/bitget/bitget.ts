import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';
import {
  BitgetAssetInfo,
  BitgetInfoResp,
  BitgetInfoRespSchema,
  BitgetPrice,
  BitgetPriceSchema,
} from './types';

/**
 * Class to fetch assets information from Bitget Exchange.
 */
export class BitgetAssetsFetcher
  implements ExchangeAssetsFetcher<BitgetAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<BitgetAssetInfo>[]> {
    const assets = (await fetchBitgetInfo()).data;
    const prices = await fetchBitgetPricesInfo();
    return assets.map(asset => {
      let price = prices.data.find(p => p.symbol === asset.symbolName);
      if (!price) {
        console.warn(
          `[Bitget] Price not found for symbol: ${asset.symbolName}`,
        );
        price = { symbol: asset.symbolName, close: '0' };
      }
      return {
        pair: {
          base: asset.baseCoin,
          quote: asset.quoteCoin,
        },
        data: {
          symbol: asset.symbolName,
          price: Number(price.close),
        },
      };
    });
  }
}

/**
 * Function to fetch products information from Bitget Exchange.
 *
 * Ref: https://bitgetlimited.github.io/apidoc/en/spot/#get-symbols
 */
export async function fetchBitgetInfo(): Promise<BitgetInfoResp> {
  const url = 'https://api.bitget.com/api/spot/v1/public/products';

  return fetchAndDecodeJSON(BitgetInfoRespSchema, url);
}

export async function fetchBitgetPricesInfo(): Promise<BitgetPrice> {
  const url = `https://api.bitget.com/api/spot/v1/market/tickers`;

  return fetchAndDecodeJSON(BitgetPriceSchema, url);
}
