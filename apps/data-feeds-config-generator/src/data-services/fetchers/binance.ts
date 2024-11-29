import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

/**
 * Schema for the information about symbols received from Binance.
 */
const BinanceSymbolInfoSchema = S.Struct({
  symbol: S.String,
  baseAsset: S.String,
  quoteAsset: S.String,
  baseAssetPrecision: S.Number,
  quoteAssetPrecision: S.Number,
});

const BinanceExchangeInfoRespSchema = S.Struct({
  symbols: S.Array(BinanceSymbolInfoSchema),
});

/**
 * Type for the information about symbols received from Binance.
 */
export type BinanceSymbolInfo = S.Schema.Type<typeof BinanceSymbolInfoSchema>;

/**
 * Function to decode Binance symbol information.
 */
export const decodeBinanceSymbolInfo = S.decodeUnknownSync(
  S.Array(BinanceSymbolInfoSchema),
);

/**
 * Function to fetch detailed information about symbols from Binance.
 *
 * Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/public-api-endpoints#exchange-information
 */
export async function fetchBinanceSymbolsInfo(): Promise<
  readonly BinanceSymbolInfo[]
> {
  const exchangeInfoUrl = 'https://api.binance.com/api/v3/exchangeInfo';

  return fetchAndDecodeJSON(BinanceExchangeInfoRespSchema, exchangeInfoUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  }).then(r => r.symbols);
}
