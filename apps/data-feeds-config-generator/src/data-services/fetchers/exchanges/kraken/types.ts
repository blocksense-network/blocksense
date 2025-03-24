import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a Kraken oracle.
 *
 * Ref: https://docs.kraken.com/api/docs/rest-api/get-ticker-information/
 * Ref: https://docs.kraken.com/api/docs/websocket-v2/ticker ( note that wsname match with symbol in their doc
 */
const KrakenAssetInfoSchema = S.mutable(
  S.Struct({
    pair: S.String,
    wsname: S.String,
    price: S.String,
  }),
);

/**
 * Type for the information about symbols received from Kraken.
 */
export type KrakenAssetInfo = S.Schema.Type<typeof KrakenAssetInfoSchema>;

/**
 * Schema for the relevant information about assets received from Kraken.
 */
export const KrakenAssetPairsRespSchema = S.Struct({
  error: S.Array(S.Any),
  result: S.Record({
    key: S.String,
    value: S.mutable(
      S.Struct({
        altname: S.String,
        wsname: S.String,
        base: S.String,
        quote: S.String,
      }),
    ),
  }),
});

export type KrakenAssetPairsResp = S.Schema.Type<
  typeof KrakenAssetPairsRespSchema
>;

export const KrakenAssetRespSchema = S.Struct({
  error: S.Array(S.Any),
  result: S.Record({
    key: S.String,
    value: S.Struct({
      altname: S.String,
    }),
  }),
});

export const KrakenPriceSchema = S.Struct({
  error: S.Array(S.Any),
  result: S.Record({
    key: S.String,
    value: S.mutable(
      S.Struct({
        a: S.Array(S.String),
      }),
    ),
  }),
});

export type KrakenPrice = S.Schema.Type<typeof KrakenPriceSchema>;
