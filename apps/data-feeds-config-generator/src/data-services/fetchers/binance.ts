import * as S from '@effect/schema/Schema';

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
 */
export async function fetchBinanceSymbolsInfo(): Promise<
  readonly BinanceSymbolInfo[]
> {
  const exchangeInfoUrl = 'https://api.binance.com/api/v3/exchangeInfo';

  const response = await fetch(exchangeInfoUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = (await response.json()) as { symbols: unknown[] };

  const supportedBinanceSymbols = decodeBinanceSymbolInfo(data.symbols);

  return supportedBinanceSymbols;
}
