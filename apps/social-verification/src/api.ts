import { Schema as S } from 'effect';
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSecurity,
} from '@effect/platform';

import { ParticipantPayloadSchema } from './types';

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  'Authorization',
  {
    failure: HttpApiError.Unauthorized,
    security: {
      apiKey: HttpApiSecurity.apiKey({
        key: 'x-api-key',
        in: 'header',
      }),
    },
  },
) {}

export const verifyApi = HttpApi.make('verify')
  .add(
    HttpApiGroup.make('x')
      .add(
        HttpApiEndpoint.post('isXUserFollowing', '/following')
          .setPayload(S.Struct({ username: S.String }))
          .addSuccess(
            S.Struct({ isFollowing: S.Boolean, userId: S.NullOr(S.String) }),
          )
          .addError(HttpApiError.NotFound),
      )
      .add(
        HttpApiEndpoint.post('hasXUserRetweeted', '/retweeted')
          .setPayload(S.Struct({ userId: S.String, retweetCode: S.String }))
          .addSuccess(
            S.Struct({ isRetweeted: S.Boolean, isCodeCorrect: S.Boolean }),
          ),
      )
      .prefix('/x'),
  )
  .add(
    HttpApiGroup.make('discord')
      .add(
        HttpApiEndpoint.post('isDiscordUserMemberOfGuild', '/member')
          .setPayload(S.Struct({ username: S.String }))
          .addSuccess(S.Struct({ isMember: S.Boolean })),
      )
      .prefix('/discord'),
  )
  .add(
    HttpApiGroup.make('mint')
      .add(
        HttpApiEndpoint.post('generateMintSignature', '/signature')
          .setPayload(S.Struct({ accountAddress: S.String }))
          .addSuccess(
            S.Union(
              S.Struct({
                signature: S.String,
                payload: S.Struct({
                  uri: S.String,
                  currency: S.String,
                  uid: S.String,
                  price: S.BigInt,
                  to: S.String,
                  royaltyRecipient: S.String,
                  royaltyBps: S.BigInt,
                  primarySaleRecipient: S.String,
                  validityStartTimestamp: S.BigInt,
                  validityEndTimestamp: S.BigInt,
                }),
              }),
              S.Struct({ error: S.String }),
            ),
          ),
      )
      .prefix('/mint'),
  )
  .add(
    HttpApiGroup.make('participants')
      .add(
        HttpApiEndpoint.post('saveParticipant', '/save')
          .setPayload(ParticipantPayloadSchema)
          .addSuccess(S.Struct({ isSuccessful: S.Boolean })),
      )
      .add(
        HttpApiEndpoint.post('checkParticipant', '/check')
          .setPayload(ParticipantPayloadSchema)
          .addSuccess(
            S.Struct({
              isParticipant: S.Boolean,
              mintingTx: S.optionalWith(S.String, { nullable: true }),
            }),
          ),
      )
      .prefix('/participants'),
  )
  .prefix('/verify')
  .middleware(Authorization);
