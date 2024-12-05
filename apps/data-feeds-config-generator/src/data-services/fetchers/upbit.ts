import * as S from '@effect/schema/Schema';

import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

/**
 * Schema for the information about symbols received from Upbit.
 */
const UpbitSymbolInfoSchema = S.Struct({
  symbol: S.String,
  market: S.String,
  name: S.String,
  base: S.String,
  quote: S.String,
  english_name: S.String,
});

const UpbitMarketRespSchema = S.Array(
  S.Struct({
    market: S.String,
    korean_name: S.String,
    english_name: S.String,
  }),
);

/**
 * Type for the information about symbols received from Upbit.
 */
export type UpbitSymbolInfo = S.Schema.Type<typeof UpbitSymbolInfoSchema>;

/**
 * Function to decode Upbit symbol information.
 */
export const decodeUpbitSymbolInfo = S.decodeUnknownSync(
  S.Array(UpbitSymbolInfoSchema),
);

/**
 * Function to fetch detailed information about symbols from Upbit.
 *
 * Ref: https://global-docs.upbit.com/reference/listing-market-list
 */
export async function fetchUpbitSymbolsInfo(): Promise<
  readonly UpbitSymbolInfo[]
> {
  const url = 'https://api.upbit.com/v1/market/all';

  const markets = await fetchAndDecodeJSON(UpbitMarketRespSchema, url);

  const supportedUpbitSymbols = decodeUpbitSymbolInfo(
    markets.map(market => {
      const [quote, base] = market.market.split('-');
      return {
        symbol: market.market,
        market: market.market,
        name: `${base}/${quote}`,
        base,
        quote,
        english_name: market.english_name,
      };
    }),
  );

  return supportedUpbitSymbols;
}
