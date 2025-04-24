import { Schema as S } from 'effect';

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
