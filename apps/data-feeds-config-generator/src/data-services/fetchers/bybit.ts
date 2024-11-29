import * as S from '@effect/schema/Schema';

/**
 * Schema for the information about symbols received from Bybit.
 */
const BybitSymbolInfoSchema = S.Struct({
  symbol: S.String,
  baseCoin: S.String,
  quoteCoin: S.String,
  status: S.String,
  lotSizeFilter: S.Struct({
    basePrecision: S.String,
    quotePrecision: S.String,
  }),
});

/**
 * Type for the information about symbols received from Bybit.
 */
export type BybitSymbolInfo = S.Schema.Type<typeof BybitSymbolInfoSchema>;

/**
 * Function to decode Bybit symbol information.
 */
export const decodeBybitSymbolInfo = S.decodeUnknownSync(
  S.Array(BybitSymbolInfoSchema),
);

/**
 * Function to fetch detailed information about symbols from Bybit.
 */
export async function fetchBybitSymbolsInfo(): Promise<
  readonly BybitSymbolInfo[]
> {
  const instrumentsInfoUrl = 'https://api.bybit.com/v5/market/instruments-info';
  const params = new URLSearchParams({ category: 'spot' });
  const headers = { Accept: 'application/json' };

  const response = await fetch(`${instrumentsInfoUrl}?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    retCode: number;
    retMsg: string;
    result?: { list: unknown[] };
  };

  if (data.retCode !== 0) {
    throw new Error(`Error: ${data.retCode} ${data.retMsg}`);
  }

  const supportedBybitSymbols = decodeBybitSymbolInfo(data.result?.list);

  return supportedBybitSymbols;
}
