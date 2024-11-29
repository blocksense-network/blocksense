import * as S from '@effect/schema/Schema';

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
 */
export async function fetchUpbitSymbolsInfo(): Promise<
  readonly UpbitSymbolInfo[]
> {
  const marketUrl = 'https://api.upbit.com/v1/market/all';

  const marketResponse = await fetch(marketUrl);
  if (!marketResponse.ok) {
    throw new Error(`Failed to fetch markets: ${marketResponse.statusText}`);
  }

  const markets = (await marketResponse.json()) as {
    market: string;
    korean_name: string;
    english_name: string;
  }[];

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
