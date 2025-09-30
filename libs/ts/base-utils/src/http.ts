import { HttpClientRequest } from '@effect/platform';
import { HttpClient } from '@effect/platform/HttpClient';
import type { HttpClientError } from '@effect/platform/HttpClientError';
import { Effect, Schema as S } from 'effect';
import type { ParseError } from 'effect/ParseResult';

/**
 * Fetches JSON from the specified URL and decodes it using the provided schema.
 *
 * @template A - The output type after decoding.
 * @template I - The input type before decoding.
 *
 * @param schema - The `S.Schema<A, I>` instance used to validate and decode the JSON.
 * @param url - The resource URL, which can be a `string`, `URL`, or `globalThis.Request`.
 * @param fetchOptions - Optional `RequestInit` configuration for the fetch request.
 *
 * @returns A promise that resolves with the decoded value of type `typeof schema.Type`.
 */
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

/**
 * Fetches JSON from the specified URL and decodes it using the provided schema.
 *
 * @template A - The decoded output type after validation.
 * @template I - The intermediate type expected by the schema.
 *
 * @param {S.Schema<A, I>} schema - The schema to decode and validate the JSON response.
 * @param {string} url - The URL to fetch the JSON from.
 *
 * @returns {Effect.Effect<A, HttpClientError | ParseError, HttpClient>}
 * An Effect that yields the decoded data of type `A`, or fails with HTTP or parsing errors.
 */
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
