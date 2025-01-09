import * as S from '@effect/schema/Schema';

/**
 * Schema for the relevant information about symbols received from Bybit.
 */
export const BybitInstrumentsInfoRespSchema = S.Struct({
  retCode: S.Number,
  retMsg: S.String,
  result: S.Struct({
    list: S.Array(
      S.Struct({
        symbol: S.String,
        baseCoin: S.String,
        quoteCoin: S.String,
      }),
    ),
  }),
});

export type BybitInstrumentsInfoResp = S.Schema.Type<
  typeof BybitInstrumentsInfoRespSchema
>;

/**
 * Schema for the data relevant to a Bybit oracle.
 *
 * Ref: https://bybit-exchange.github.io/docs/v5/market/tickers#request-parameters
 */
const BybitAssetInfoSchema = S.mutable(
  S.Struct({
    symbol: S.String,
  }),
);

export type BybitAssetInfo = S.Schema.Type<typeof BybitAssetInfoSchema>;

/**
 * Function to decode Bybit symbol information.
 */
export const decodeBybitSymbolInfo = S.decodeUnknownSync(
  S.mutable(S.Array(BybitAssetInfoSchema)),
);
