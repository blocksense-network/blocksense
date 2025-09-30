import { Schema as S } from 'effect';

/**
 * Schema for the data relevant to a GateIo Exchange oracle.
 *
 * Ref: https://www.gate.io/docs/developers/apiv4/en/#spot
 */
const _GateIoAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.String,
    price: S.Number,
  }),
);

export type GateIoAssetInfo = typeof _GateIoAssetInfoSchema.Type;

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

export type GateIoInfoResp = typeof GateIoInfoRespSchema.Type;

export const GateIoPriceSchema = S.Array(
  S.mutable(
    S.Struct({
      currency_pair: S.String,
      last: S.String,
    }),
  ),
);

export type GateIoPrice = typeof GateIoPriceSchema.Type;
