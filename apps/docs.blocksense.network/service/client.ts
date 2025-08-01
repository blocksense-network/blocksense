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
