import { Schema as S } from 'effect';

export const XUserInfoResponseSchema = S.Struct({
  id_str: S.String,
  screen_name: S.String,
});

export const XUserFollowingResponseSchema = S.Struct({
  is_following: S.Boolean,
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
