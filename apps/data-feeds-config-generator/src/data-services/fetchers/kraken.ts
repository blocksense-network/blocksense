import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

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

const KrakenAssetPairsRespSchema = S.Struct({
  error: S.Array(S.Any),
  result: S.Record({
    key: S.String,
    value: S.Unknown,
  }),
});

/**
 * Function to decode Kraken symbol information.
 */
export const decodeKrakenSymbolInfo = S.decodeUnknownSync(
  S.Array(KrakenSymbolInfoSchema),
);

/**
 * Type for the information about symbols received from Kraken.
 */
export type KrakenSymbolInfo = S.Schema.Type<typeof KrakenSymbolInfoSchema>;

/**
 * Function to fetch detailed information about symbols from Kraken.
 *
 * Ref: https://docs.kraken.com/api/docs/rest-api/get-tradable-asset-pairs
 */
export async function fetchKrakenSymbolsInfo(): Promise<
  readonly KrakenSymbolInfo[]
> {
  const assetPairsUrl = 'https://api.kraken.com/0/public/AssetPairs';

  const pairsData = await fetchAndDecodeJSON(
    KrakenAssetPairsRespSchema,
    assetPairsUrl,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  );

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
