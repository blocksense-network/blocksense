import { Schema as S } from 'effect';

export function fetchAndDecodeJSON<A, I>(
  schema: S.Schema<A, I>,
  url: string | URL | globalThis.Request,
  fetchOptions?: RequestInit,
): Promise<S.Schema.Type<typeof schema>> {
  const { headers: additionalHeaders, ...options } = fetchOptions || {};

  return fetch(url, {
    headers: {
      Accept: 'application/json',
      ...additionalHeaders,
    },
    ...options,
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
