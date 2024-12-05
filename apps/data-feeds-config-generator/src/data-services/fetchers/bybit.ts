import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

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

const BybitInstrumentsInfoRespSchema = S.Struct({
  retCode: S.Number,
  retMsg: S.String,
  result: S.Struct({
    list: S.Array(S.Unknown),
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
  const url = 'https://api.bybit.com/v5/market/instruments-info?category=spot';

  const data = await fetchAndDecodeJSON(BybitInstrumentsInfoRespSchema, url);

  if (data.retCode !== 0) {
    throw new Error(`Error: ${data.retCode} ${data.retMsg}`);
  }

  return decodeBybitSymbolInfo(data.result?.list);
}
