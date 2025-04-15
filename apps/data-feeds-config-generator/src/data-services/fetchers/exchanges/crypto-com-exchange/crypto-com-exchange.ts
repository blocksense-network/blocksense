import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AssetInfo, ExchangeAssetsFetcher } from '../exchange-assets';
import {
  CryptoComAssetInfo,
  CryptoComInfoResp,
  CryptoComInfoRespSchema,
  CryptoComPrice,
  CryptoComPriceSchema,
} from './types';

/**
 * Class to fetch assets information from CryptoCom Exchange.
 */
export class CryptoComAssetsFetcher
  implements ExchangeAssetsFetcher<CryptoComAssetInfo>
{
  async fetchAssets(): Promise<AssetInfo<CryptoComAssetInfo>[]> {
    const assets = (await fetchCryptoComInfo()).result.data.filter(
      asset => asset.inst_type === 'CCY_PAIR',
    );
    const prices = (await fetchCryptoComPricesInfo()).result.data;
    return assets.map(asset => {
      let price = prices.find(p => p.i === asset.symbol);
      if (!price) {
        console.warn(`[CryptoCom] Price not found for symbol: ${asset.symbol}`);
        price = { i: asset.symbol, a: '0' };
      }
      return {
        pair: {
          base: asset.base_ccy,
          quote: asset.quote_ccy,
        },
        data: {
          symbol: asset.symbol,
          price: Number(price.a),
        },
      };
    });
  }
}

/**
 * Function to fetch products information from CryptoCom Exchange.
 *
 * Ref: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html#public-get-instruments
 */
export async function fetchCryptoComInfo(): Promise<CryptoComInfoResp> {
  const url = 'https://api.crypto.com/exchange/v1/public/get-instruments';

  return fetchAndDecodeJSON(CryptoComInfoRespSchema, url);
}

export async function fetchCryptoComPricesInfo(): Promise<CryptoComPrice> {
  const url = `https://api.crypto.com/exchange/v1/public/get-tickers`;

  return fetchAndDecodeJSON(CryptoComPriceSchema, url);
}
