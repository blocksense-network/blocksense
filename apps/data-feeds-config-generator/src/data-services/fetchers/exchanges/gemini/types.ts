import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Gemini Exchange oracle.
 *
 * Ref: https://docs.gemini.com/rest-api/#ticker
 */
const GeminiAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    price: S.Number,
  }),
);

export type GeminiAssetInfo = S.Schema.Type<typeof GeminiAssetInfoSchema>;

/**
 * Schema for the relevant information about symbols received from Gemini Exchange.
 */
export const GeminiSymbolsInfoRespSchema = S.mutable(S.Array(S.String));

export type GeminiSymbolsInfoResp = S.Schema.Type<
  typeof GeminiSymbolsInfoRespSchema
>;

/**
 * Schema for the relevant information about symbol details received from Gemini Exchange.
 */
export const GeminiSymbolDetailsInfoRespSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    base_currency: S.String,
    quote_currency: S.String,
  }),
);

export type GeminiSymbolDetailsInfoResp = S.Schema.Type<
  typeof GeminiSymbolDetailsInfoRespSchema
>;

export const GeminiPriceSchema = S.Struct({
  last: S.String,
});

export type GeminiPrice = S.Schema.Type<typeof GeminiPriceSchema>;
