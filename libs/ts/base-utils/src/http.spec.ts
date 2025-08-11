import {
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import { Effect, Layer, Schema as S } from 'effect';
import { describe, expect, it } from '@effect/vitest';
import { fetchAndDecodeJSONEffect } from './http';
import { ParseError } from 'effect/ParseResult';

const user = S.Struct({
  userId: S.Number,
  id: S.Number,
  title: S.String,
  body: S.String,
});

const successRequest = HttpClientRequest.get('https://api.example.com/users/1');
const invalidDataRequest = HttpClientRequest.get(
  'https://api.example.com/invalid-data',
);
const invalidJsonRequest = HttpClientRequest.get(
  'https://api.example.com/invalid-json',
);
const serverErrorRequest = HttpClientRequest.get(
  'https://api.example.com/server-error',
);

const mockSuccessResponse = HttpClientResponse.fromWeb(
  successRequest,
  new Response(
    JSON.stringify({
      userId: 1,
      id: 1,
      title: 'Some title',
      body: 'Some body',
    }),
    { status: 200, statusText: 'OK' },
  ),
);

const mockInvalidDataResponse = HttpClientResponse.fromWeb(
  invalidDataRequest,
  new Response(JSON.stringify({ id: '1', title: 123 }), {
    status: 200,
    statusText: 'OK',
  }),
);

const mockInvalidJsonResponse = HttpClientResponse.fromWeb(
  invalidJsonRequest,
  new Response('{"id": 1,}', { status: 200, statusText: 'OK' }),
);

const mockErrorResponse = HttpClientResponse.fromWeb(
  serverErrorRequest,
  new Response('Internal Server Error', { status: 500, statusText: 'Error' }),
);

const makeTestClient = (
  effect: Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError
  >,
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => effect),
  );

describe('fetchAndDecodeJSONEffect', () => {
  it.effect('should succeed with decoded data for a valid response', () =>
    Effect.gen(function* () {
      const result = yield* fetchAndDecodeJSONEffect(
        user,
        'https://api.example.com/users/1',
      );

      expect(result).toStrictEqual({
        userId: 1,
        id: 1,
        title: 'Some title',
        body: 'Some body',
      });
    }).pipe(
      Effect.provide(makeTestClient(Effect.succeed(mockSuccessResponse))),
    ),
  );

  it.effect(
    'should fail with a ParseError for data that does not match the schema',
    () =>
      Effect.gen(function* () {
        const result = yield* Effect.flip(
          fetchAndDecodeJSONEffect(
            user,
            'https://api.example.com/invalid-data',
          ),
        );
        expect(result).toBeInstanceOf(ParseError);
      }).pipe(
        Effect.provide(makeTestClient(Effect.succeed(mockInvalidDataResponse))),
      ),
  );

  it.effect('should fail with an HttpClientError for invalid JSON', () =>
    Effect.gen(function* () {
      const result = yield* Effect.flip(
        fetchAndDecodeJSONEffect(user, 'https://api.example.com/invalid-json'),
      );

      expect(result).toBeInstanceOf(HttpClientError.ResponseError);
      expect(result.message).toBe(
        'Decode error (200 GET https://api.example.com/invalid-json)',
      );
    }).pipe(
      Effect.provide(makeTestClient(Effect.succeed(mockInvalidJsonResponse))),
    ),
  );

  it.effect(
    'should fail with an HttpClientResponseError for a non-2xx response',
    () =>
      Effect.gen(function* () {
        const result = yield* Effect.flip(
          fetchAndDecodeJSONEffect(
            user,
            'https://api.example.com/server-error',
          ),
        );

        expect(result).toBeInstanceOf(HttpClientError.ResponseError);
        expect(result.message).toBe(
          'StatusCode error (500 GET https://api.example.com/server-error)',
        );
      }).pipe(
        Effect.provide(
          makeTestClient(
            Effect.fail(
              new HttpClientError.ResponseError({
                request: serverErrorRequest,
                response: mockErrorResponse,
                reason: 'StatusCode',
              }),
            ),
          ),
        ),
      ),
  );
});
