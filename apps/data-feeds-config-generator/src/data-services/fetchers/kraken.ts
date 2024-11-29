import * as S from '@effect/schema/Schema';

/**
 * Schema for the information about symbols received from Kraken.
 */
const KrakenSymbolInfoSchema = S.Struct({
  symbol: S.String,
  altname: S.String,
  wsname: S.String,
  aclass_base: S.String,
  base: S.String,
  aclass_quote: S.String,
  quote: S.String,
  lot: S.String,
  pair_decimals: S.Number,
});

/**
 * Type for the information about symbols received from Kraken.
 */
export type KrakenSymbolInfo = S.Schema.Type<typeof KrakenSymbolInfoSchema>;

/**
 * Function to decode Kraken symbol information.
 */
export const decodeKrakenSymbolInfo = S.decodeUnknownSync(
  S.Array(KrakenSymbolInfoSchema),
);

/**
 * Function to fetch detailed information about symbols from Kraken.
 */
export async function fetchKrakenSymbolsInfo(): Promise<
  readonly KrakenSymbolInfo[]
> {
  const assetPairsUrl = 'https://api.kraken.com/0/public/AssetPairs';

  // Fetch all trading pairs
  const pairsResponse = await fetch(assetPairsUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!pairsResponse.ok) {
    throw new Error(`Failed to fetch asset pairs: ${pairsResponse.status}`);
  }

  const pairsData = (await pairsResponse.json()) as {
    error: unknown[];
    result: Record<string, unknown>;
  };

  if (pairsData.error.length > 0) {
    throw new Error(`Found errors in paris data: ${pairsData.error}`);
  }

  const supportedKrakenSymbols = decodeKrakenSymbolInfo(
    Object.entries(pairsData.result).map(([key, value]) => ({
      symbol: key,
      ...(value as Object),
    })),
  );

  return supportedKrakenSymbols;
}
