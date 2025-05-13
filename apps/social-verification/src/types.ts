import { Schema as S } from 'effect';

export const XUserInfoResponseSchema = S.Struct({
  id_str: S.String,
  screen_name: S.String,
});

export const XUserFollowingResponseSchema = S.Struct({
  is_following: S.Boolean,
});

export const TweetsResponseSchema = S.Struct({
  tweets: S.Array(
    S.Struct({
      full_text: S.String,
      quoted_status: S.NullOr(
        S.Struct({
          id_str: S.String,
        }),
      ),
    }),
  ),
});

export const DiscordUserInfoResponseSchema = S.Array(
  S.Struct({
    user: S.Struct({ id: S.String, username: S.String }),
  }),
);

export const ParticipantPayloadSchema = S.mutable(
  S.Struct({
    xHandle: S.String,
    discordUsername: S.String,
    walletAddress: S.String,
    mintingTx: S.optionalWith(S.String, { nullable: true }),
  }),
);

export type ParticipantPayload = S.Schema.Type<typeof ParticipantPayloadSchema>;
