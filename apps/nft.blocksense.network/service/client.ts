'use client';

import { Effect } from 'effect';

import {
  FetchHttpClient,
  HttpApiClient,
  HttpClient,
  HttpClientRequest,
} from '@effect/platform';

import { assertNotNull } from '@blocksense/base-utils/assert';

import { verifyApi } from '@blocksense/social-verification/api';
import {
  HttpApiDecodeError,
  Unauthorized,
} from '@effect/platform/HttpApiError';
import { HttpClientError } from '@effect/platform/HttpClientError';
import { ParseError } from 'effect/Cron';
import { ParticipantPayload } from '@blocksense/social-verification/types';

export function getApiClient() {
  const baseUrl = assertNotNull(
    process.env['NEXT_PUBLIC_VERIFICATION_API_URL'],
    'NEXT_PUBLIC_VERIFICATION_API_URL is not defined',
  );
  const apiKey = assertNotNull(
    process.env['NEXT_PUBLIC_VERIFICATION_API_KEY'],
    'NEXT_PUBLIC_VERIFICATION_API_KEY is not defined',
  );

  const rawClientEffect = HttpApiClient.make(verifyApi, {
    baseUrl,
    transformClient: client =>
      client.pipe(
        HttpClient.mapRequest(HttpClientRequest.setHeader('x-api-key', apiKey)),
      ),
  });

  return rawClientEffect.pipe(Effect.provide(FetchHttpClient.layer));
}

export const apiClient = getApiClient();

type ResolvedApiClient = Effect.Effect.Success<typeof apiClient>;

const createApiRequestHandler = <
  TArgs extends any[],
  TPayload,
  TResponse,
  E =
    | HttpApiDecodeError
    | Unauthorized
    | HttpClientError
    | ParseError
    | unknown,
>(
  serviceCall: (
    client: ResolvedApiClient,
    payload: TPayload,
  ) => Effect.Effect<TResponse, E, never>,
  payloadCreator: (...args: TArgs) => TPayload,
): ((...args: TArgs) => Promise<TResponse>) => {
  return (...args: TArgs): Promise<TResponse> =>
    Effect.runPromise(
      Effect.gen(function* (_) {
        // Yield the apiClient Effect to get the resolved client instance
        const client: ResolvedApiClient = yield* _(apiClient);
        // Create the payload using the provided creator function
        const structuredPayload = payloadCreator(...args);
        // Yield the Effect returned by the serviceCall function
        const response = yield* _(serviceCall(client, structuredPayload));
        return response;
      }),
    );
};

type DiscordMemberResponse = { isMember: boolean };
type XUserFollowingResponse = { isFollowing: boolean; userId: string | null };
type MintNftResponsePayload = {
  uri: string;
  currency: string;
  uid: string;
  price: bigint;
  to: string;
  royaltyRecipient: string;
  royaltyBps: bigint;
  primarySaleRecipient: string;
  validityStartTimestamp: bigint;
  validityEndTimestamp: bigint;
};
type MintNftResponse = { signature: string; payload: MintNftResponsePayload };
type SaveParticipantResponse = { isSuccessful: boolean };
type CheckParticipantResponse = {
  isParticipant: boolean;
  mintingTx?: string;
};

export const isDiscordUserMemberOfGuild = createApiRequestHandler<
  [string],
  { username: string },
  DiscordMemberResponse
>(
  (client, payload) => client.discord.isDiscordUserMemberOfGuild({ payload }),
  username => ({ username }),
);

export const isXUserFollowing = createApiRequestHandler<
  [string],
  { username: string },
  XUserFollowingResponse
>(
  (client, payload) => client.x.isXUserFollowing({ payload }),
  username => ({ username }),
);

export const generateMintSignature = createApiRequestHandler<
  [string],
  { accountAddress: string },
  MintNftResponse
>(
  (client, payload) => client.mint.generateMintSignature({ payload }),
  accountAddress => ({ accountAddress }),
);

export const saveParticipant = createApiRequestHandler<
  [ParticipantPayload],
  ParticipantPayload,
  SaveParticipantResponse
>(
  (client, payload) => client.participants.saveParticipant({ payload }),
  payload => payload,
);

export const checkParticipant = createApiRequestHandler<
  [ParticipantPayload],
  ParticipantPayload,
  CheckParticipantResponse
>(
  (client, payload) => client.participants.checkParticipant({ payload }),
  payload => payload,
);
