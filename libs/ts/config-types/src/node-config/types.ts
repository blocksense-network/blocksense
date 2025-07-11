import { Schema as S } from 'effect';

// This is a partial schema including only allowed feeds
// TODO: (danielstoyanov) Expand to whole config schema
// TODO: (danielstoyanov) Add schema for sequencer config v2
export const SequencerConfigV1Schema = S.mutable(
  S.Struct({
    providers: S.Record({
      key: S.String,
      value: S.Struct({
        allow_feeds: S.optional(S.Array(S.Number)),
      }),
    }),
  }),
);

export type SequencerConfigV1 = typeof SequencerConfigV1Schema.Type;
