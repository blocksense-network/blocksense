import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a GateIo Exchange oracle.
 *
 * Ref: https://www.gate.io/docs/developers/apiv4/en/#spot
 */
const GateIoAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.String,
    price: S.String,
  }),
);

export type GateIoAssetInfo = S.Schema.Type<typeof GateIoAssetInfoSchema>;

/**
 * Schema for the relevant information about products received from GateIo Exchange.
 */
export const GateIoInfoRespSchema = S.mutable(
  S.Array(
    S.Struct({
      id: S.String,
      base: S.String,
      quote: S.String,
    }),
  ),
);

export type GateIoInfoResp = S.Schema.Type<typeof GateIoInfoRespSchema>;

export const GateIoPriceSchema = S.Array(
  S.mutable(
    S.Struct({
      currency_pair: S.String,
      last: S.String,
    }),
  ),
);

export type GateIoPrice = S.Schema.Type<typeof GateIoPriceSchema>;
