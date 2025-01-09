import { Schema as S } from 'effect';

/**
 * Schema for the relevant information about symbols received from Gemini Exchange.
 */
export const GeminiExchangeSymbolsInfoRespSchema = S.mutable(S.Array(S.String));

export type GeminiExchangeSymbolsInfoResp = S.Schema.Type<
  typeof GeminiExchangeSymbolsInfoRespSchema
>;

/**
 * Schema for the relevant information about symbol details received from Gemini Exchange.
 */
export const GeminiExchangeSymbolDetailsInfoRespSchema = S.mutable(
  S.Struct({
    symbol: S.String,
    base_currency: S.String,
    quote_currency: S.String,
  }),
);

export type GeminiExchangeSymbolDetailsInfoResp = S.Schema.Type<
  typeof GeminiExchangeSymbolDetailsInfoRespSchema
>;

/**
 * Schema for the data relevant to a Gemini Exchange oracle.
 *
 * Ref: https://docs.gemini.com/rest-api/#ticker
 */
const GeminiExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type GeminiExchangeAssetInfo = S.Schema.Type<
  typeof GeminiExchangeAssetInfoSchema
>;
