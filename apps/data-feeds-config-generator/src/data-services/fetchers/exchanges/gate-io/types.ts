import * as S from '@effect/schema/Schema';

/**
 * Schema for the relevant information about products received from GateIo Exchange.
 */
export const GateIoExchangeInfoRespSchema = S.mutable(
  S.Array(
    S.Struct({
      id: S.String,
      base: S.String,
      quote: S.String,
    }),
  ),
);

export type GateIoExchangeInfoResp = S.Schema.Type<
  typeof GateIoExchangeInfoRespSchema
>;

/**
 * Schema for the data relevant to a GateIo Exchange oracle.
 *
 * Ref: https://www.gate.io/docs/developers/apiv4/en/#spot
 */
const GateIoExchangeAssetInfoSchema = S.mutable(
  S.Struct({
    id: S.String,
  }),
);

export type GateIoExchangeAssetInfo = S.Schema.Type<
  typeof GateIoExchangeAssetInfoSchema
>;
