import { Schema as S } from 'effect';
import { HttpApiSchema } from '@effect/platform';

import type { RetweetCheckPayload } from './types';
import { TweetsResponseSchema } from './types';

export class TooManyRequests extends HttpApiSchema.EmptyError<TooManyRequests>()(
  {
    tag: 'TooManyRequests',
    status: 429,
  },
) {}

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
      if (response.status === 429) {
        throw new TooManyRequests();
      }
      if (!response.ok) {
        throw new Error(
          `Failed to fetch JSON from ${url}; status=${response.status}`,
        );
      }
      return response.json();
    })
    .then(json => S.decodeUnknownSync(schema)(json));
}

export async function checkCodeRetweet(
  payload: RetweetCheckPayload,
  tweetId: string,
  socialDataApiKey: string,
) {
  const { retweetCode, userId } = payload;
  const xUserRetweetsResponse = await fetchAndDecodeJSON(
    TweetsResponseSchema,
    `https://api.socialdata.tools/twitter/user/${userId}/tweets`,
    {
      headers: {
        Authorization: `Bearer ${socialDataApiKey}`,
      },
    },
  );
  console.log(`Successfully fetched retweet. userId: ${userId}`);

  const targetRetweets = xUserRetweetsResponse.tweets.filter(
    tweet => tweet.quoted_status?.id_str === tweetId,
  );
  if (!targetRetweets || targetRetweets.length === 0) {
    console.error(
      `No quoted retweets found for user ${userId} on tweet ${tweetId}`,
    );
    return { isRetweeted: false, isCodeCorrect: false };
  }

  const retweetContainsCode = targetRetweets.some(tweet =>
    tweet.full_text.includes(retweetCode),
  );
  if (!retweetContainsCode) {
    console.error(
      `Retweet does not contain the correct code for user ${userId} on tweet ${tweetId}`,
    );
    return { isRetweeted: true, isCodeCorrect: false };
  }

  console.log(
    `Successfully verified quote retweet for user ${userId} on tweet ${tweetId} with code ${retweetCode}`,
  );

  return {
    isRetweeted: true,
    isCodeCorrect: true,
  };
}
