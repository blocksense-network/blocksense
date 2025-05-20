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

export type GeminiAssetInfo = typeof GeminiAssetInfoSchema.Type;

/**
 * Schema for the relevant information about symbols received from Gemini Exchange.
 */
export const GeminiSymbolsInfoRespSchema = S.mutable(S.Array(S.String));

export type GeminiSymbolsInfoResp = typeof GeminiSymbolsInfoRespSchema.Type;

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

export type GeminiSymbolDetailsInfoResp =
  typeof GeminiSymbolDetailsInfoRespSchema.Type;

export const GeminiPriceSchema = S.Struct({
  last: S.String,
});

export type GeminiPrice = typeof GeminiPriceSchema.Type;
