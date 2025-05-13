import {
  Context,
  Effect as E,
  Effect,
  Layer,
  Redacted,
  Schema as S,
} from 'effect';
import { Tag } from 'effect/Context';
import { NotFound, Unauthorized } from '@effect/platform/HttpApiError';
import { HttpMethod } from '@effect/platform/HttpMethod';
import { HttpApiBuilder } from '@effect/platform';
import { createThirdwebClient, getContract } from 'thirdweb';
import { arbitrum } from 'thirdweb/chains';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { generateMintSignature } from 'thirdweb/extensions/erc721';

import { Authorization, verifyApi } from './api';
import {
  DiscordUserInfoResponseSchema,
  TweetsResponseSchema,
  XUserFollowingResponseSchema,
  XUserInfoResponseSchema,
} from './types';
import { fetchAndDecodeJSON } from './utils';

type ApiEndpoint<RequestA, RequestI, ResponseA, ResponseI> = {
  method: HttpMethod;
  path: `/${string}`;
  requestSchema: S.Schema<RequestA, RequestI, never>;
  responseSchema: S.Schema<ResponseA, ResponseI, never>;
};

type Api = Record<string, ApiEndpoint<any, any, any, any>>;

type ApiServer<ApiType extends Api> = {
  [K in keyof ApiType]: (
    requestBody: S.Schema.Type<ApiType[K]['requestSchema']>,
  ) => E.Effect<S.Schema.Type<ApiType[K]['responseSchema']>>;
};

export const EnvTag = Context.Tag('Env');

function getEnv(context: any) {
  return Context.get(context, EnvTag as any as Tag<unknown, any>);
}

const cors = HttpApiBuilder.middlewareCors({
  allowedOrigins: ['https://nft.blocksense.network', 'http://localhost:3002'],
  allowedMethods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  allowedHeaders: ['*'],
  maxAge: 86400,
});

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    console.log('Creating Authorization middleware');
    return {
      apiKey: (apiKey: Redacted.Redacted<string>) =>
        Effect.contextWith(context => {
          const expectedApiKey = getEnv(context)['API_KEY'];

          if (expectedApiKey !== Redacted.value(apiKey)) {
            console.log('Unauthorized access attempt');
            throw new Unauthorized();
          }

          console.log('Authorized access');
        }),
    };
  }),
);

export const VerifyApiLive = HttpApiBuilder.api(verifyApi).pipe(
  Layer.provide(cors),
  Layer.provide(AuthorizationLive),
  Layer.provide(
    HttpApiBuilder.group(verifyApi, 'x', handlers =>
      handlers
        .handle('isXUserFollowing', ({ payload }) =>
          server.isXUserFollowing(payload),
        )
        .handle('hasXUserRetweeted', ({ payload }) =>
          server.hasXUserRetweeted(payload),
        ),
    ),
  ),
  Layer.provide(
    HttpApiBuilder.group(verifyApi, 'discord', handlers =>
      handlers.handle('isDiscordUserMemberOfGuild', ({ payload }) =>
        server.isDiscordUserMemberOfGuild(payload),
      ),
    ),
  ),
  Layer.provide(
    HttpApiBuilder.group(verifyApi, 'mint', handlers =>
      handlers.handle('generateMintSignature', ({ payload }) =>
        server.generateMintSignature(payload),
      ),
    ),
  ),
  Layer.provide(
    HttpApiBuilder.group(verifyApi, 'participants', handlers =>
      handlers
        .handle('saveParticipant', ({ payload }) =>
          server.saveParticipant(payload),
        )
        .handle('checkParticipant', ({ payload }) =>
          server.checkParticipant(payload),
        ),
    ),
  ),
);

export const server: ApiServer<Api> = {
  isXUserFollowing: payload =>
    Effect.contextWithEffect(context => {
      const env = getEnv(context);
      const socialDataApiKey = env['SOCIAL_DATA_API_KEY'];
      const xBlocksenseAccountId = env['X_BLOCKSENSE_ACCOUNT_ID'];

      const username = payload.username;

      return Effect.tryPromise({
        try: async () => {
          const xUserInfoResponse = await fetchAndDecodeJSON(
            XUserInfoResponseSchema,
            `https://api.socialdata.tools/twitter/user/${username}`,
            {
              headers: {
                Authorization: `Bearer ${socialDataApiKey}`,
              },
            },
          );

          const userId = xUserInfoResponse.id_str;
          if (!userId) {
            console.error(`User ID not found in response for user ${username}`);
            throw new NotFound();
          }
          console.log(
            `Successfully fetched user ID. username: ${username} id: ${userId}`,
          );

          const xUserFollowingResponse = await fetchAndDecodeJSON(
            XUserFollowingResponseSchema,
            `https://api.socialdata.tools/twitter/user/${userId}/following/${xBlocksenseAccountId}`,
            {
              headers: {
                Authorization: `Bearer ${socialDataApiKey}`,
              },
            },
          );
          console.log(
            `Successfully fetched user following status. username: ${username} id: ${userId} isFollowing: ${xUserFollowingResponse.is_following}`,
          );

          return {
            isFollowing: xUserFollowingResponse.is_following,
            userId,
          };
        },
        catch: error => {
          if (error instanceof Error && error.message.includes('404')) {
            console.error(`User ${username} not found:`, error);
            throw new NotFound();
          }
          console.error(`Error getting info for user ${username}:`, error);
          throw new Error('Failed to fetch X user info');
        },
      });
    }),

  hasXUserRetweeted: payload =>
    Effect.contextWithEffect(context => {
      const env = getEnv(context);
      const tweetId = env['X_BLOCKSENSE_TWEET_ID'];
      const socialDataApiKey = env['SOCIAL_DATA_API_KEY'];

      const userId = payload.userId;

      return Effect.tryPromise({
        try: async () => {
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
            tweet.full_text.includes(payload.retweetCode),
          );
          if (!retweetContainsCode) {
            console.error(
              `Retweet does not contain the correct code for user ${userId} on tweet ${tweetId}`,
            );
            return { isRetweeted: true, isCodeCorrect: false };
          }

          console.log(
            `Successfully verified quote retweet for user ${userId} on tweet ${tweetId} with code ${payload.retweetCode}`,
          );

          return {
            isRetweeted: true,
            isCodeCorrect: true,
          };
        },
        catch: error => {
          console.error(`Error fetching X user ${userId} retweets`, error);
          throw new Error('Failed to fetch retweets');
        },
      });
    }),

  isDiscordUserMemberOfGuild: payload =>
    Effect.contextWithEffect(context => {
      const env = getEnv(context);
      const discordBotToken = env['DISCORD_BOT_TOKEN'];
      const discordGuildId = env['DISCORD_BLOCKSENSE_GUILD_ID'];
      const username = payload.username;

      return Effect.tryPromise({
        try: async () => {
          const discordResponse = await fetchAndDecodeJSON(
            DiscordUserInfoResponseSchema,
            `https://discord.com/api/v10/guilds/${discordGuildId}/members/search?query=${username}`,
            {
              headers: {
                Authorization: `Bot ${discordBotToken}`,
              },
            },
          );
          console.log(
            `Successfully fetched Discord member. username: ${username}`,
          );

          const isMember = discordResponse.some(
            member => member.user?.username === username,
          );

          return { isMember };
        },
        catch: error => {
          console.error('Error fetching Discord members:', error);
          throw new Error('Failed to fetch Discord members');
        },
      });
    }),

  generateMintSignature: payload =>
    Effect.contextWithEffect(context => {
      const env = getEnv(context);
      const CLIENT_ID = env['NFT_CLIENT_ID'];
      const CONTRACT_ADDRESS = env['NFT_SMART_CONTRACT_ADDRESS'];
      const PRIVATE_KEY = env['NFT_PRIVATE_KEY'];

      const metadata = {
        name: 'Blocksense Pirate',
        description: 'Exclusive NFT for Blocksense supporters.',
        image: 'https://data.nft.blocksense.network/bsx-pirate-nft.png',
        attributes: [
          {
            trait_type: 'Author',
            value: 'Sean Go',
          },
          {
            trait_type: 'Company',
            value: 'Blocksense',
          },
          {
            trait_type: 'Website',
            value: 'https://blocksense.network',
          },
        ],
      };

      return Effect.tryPromise({
        try: async () => {
          const client = createThirdwebClient({
            clientId: CLIENT_ID,
          });

          const contract = getContract({
            client,
            chain: arbitrum,
            address: CONTRACT_ADDRESS,
          });

          const admin = privateKeyToAccount({
            client,
            privateKey: PRIVATE_KEY,
          });

          const { payload: generatedPayload, signature } =
            await generateMintSignature({
              account: admin,
              contract,
              mintRequest: {
                to: payload.accountAddress,
                metadata,
              },
              contractType: 'TokenERC721',
            });

          console.log(
            `Successfully generated mint signature - ${signature} for account ${payload.accountAddress}`,
          );

          return { signature, payload: generatedPayload };
        },
        catch: error => {
          console.error('Error getting mint signature:', error);
          throw new Error('Error getting mint signature');
        },
      });
    }),

  saveParticipant: payload =>
    Effect.contextWithEffect(context => {
      const env = getEnv(context);

      return Effect.tryPromise({
        try: async () => {
          const db = env.DB;

          console.log(
            `Inserting participant data.\n` + JSON.stringify(payload),
          );

          const insertQuery =
            'INSERT INTO participants (x_handle, discord_username, wallet_address, minting_tx) VALUES (?, ?, ?, ?)';
          const insertResult = await db
            .prepare(insertQuery)
            .bind(
              payload.xHandle,
              payload.discordUsername,
              payload.walletAddress,
              payload.mintingTx,
            )
            .all();

          console.log(`Successfully inserted participant data`);

          return { isSuccessful: insertResult.success };
        },
        catch: error => {
          console.error('Error inserting data into database:', error);
          throw new Error('Failed to insert data into database');
        },
      });
    }),

  checkParticipant: payload =>
    Effect.contextWithEffect(context => {
      const env = getEnv(context);

      return Effect.tryPromise({
        try: async () => {
          const db = env.DB;

          console.log(`Checking participant data:\n` + JSON.stringify(payload));

          const selectQuery = `
          SELECT * FROM participants
          WHERE x_handle = ?
            OR discord_username = ?
            OR wallet_address = ?
          `;
          const selectResult = await db
            .prepare(selectQuery)
            .bind(
              payload.xHandle,
              payload.discordUsername,
              payload.walletAddress,
            )
            .all();

          const results = selectResult.results;
          const isParticipant = results.length > 0;
          const participantMintTx = isParticipant
            ? results[0].minting_tx
            : undefined;

          console.log(`Participant check result: ${isParticipant}`);

          return { isParticipant: isParticipant, mintingTx: participantMintTx };
        },
        catch: error => {
          console.error('Error checking data in database:', error);
          throw new Error('Failed to check data in database');
        },
      });
    }),
};
