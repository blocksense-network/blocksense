import { HttpClientRequest } from '@effect/platform';
import { HttpClient } from '@effect/platform/HttpClient';
import { HttpClientError } from '@effect/platform/HttpClientError';
import { Effect, Schema as S } from 'effect';
import { ParseError } from 'effect/ParseResult';

export function fetchAndDecodeJSON<A, I>(
  schema: S.Schema<A, I>,
  url: string | URL | globalThis.Request,
  fetchOptions?: RequestInit,
): Promise<typeof schema.Type> {
  return fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    ...fetchOptions,
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch JSON from ${url}; status=${response.status}`,
        );
      }
      return response.json();
    })
    .then(json => S.decodeUnknownSync(schema)(json));
}

export const fetchAndDecodeJSONEffect = <A, I>(
  schema: S.Schema<A, I>,
  url: string,
): Effect.Effect<A, HttpClientError | ParseError, HttpClient> => {
  return Effect.gen(function* () {
    const request = HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeaders({
        'Content-Type': 'application/json; charset=UTF-8',
      }),
    );
    const client = yield* HttpClient;

    const json = yield* client
      .execute(request)
      .pipe(Effect.flatMap(res => res.json));

    return yield* S.decodeUnknown(schema)(json);
  });
};
