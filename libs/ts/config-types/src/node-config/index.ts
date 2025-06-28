import { Schema as S } from 'effect';

export const SequencerDeploymentConfigSchema = S.mutable(
  S.Struct({
    providers: S.Record({
      key: S.String,
      value: S.Struct({
        allow_feeds: S.NullishOr(S.Array(S.Number)),
      }),
    }),
  }),
);
export type SequencerDeploymentConfig =
  typeof SequencerDeploymentConfigSchema.Type;
