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
import { balanceOf, generateMintSignature } from 'thirdweb/extensions/erc721';
import Web3 from 'web3';

import { Authorization, verifyApi } from './api';
import {
  DiscordUserInfoResponseSchema,
  TweetsResponseSchema,
  XUserFollowingResponseSchema,
  XUserInfoResponseSchema,
} from './types';
import { checkCodeRetweet, fetchAndDecodeJSON, TooManyRequests } from './utils';

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
          let xUserInfoResponse;
          try {
            xUserInfoResponse = await fetchAndDecodeJSON(
              XUserInfoResponseSchema,
              `https://api.socialdata.tools/twitter/user/${username}`,
              {
                headers: {
                  Authorization: `Bearer ${socialDataApiKey}`,
                },
              },
            );
          } catch (error) {
            if (error instanceof TooManyRequests) {
              console.warn(
                'Too many requests to X API, returning isFollowing as true',
              );
              return {
                isFollowing: true,
                userId: '',
              };
            } else {
              throw error;
            }
          }

          const userId = xUserInfoResponse.id_str;
          if (!userId) {
            console.error(`User ID not found in response for user ${username}`);
            throw new NotFound();
          }
          console.log(
            `Successfully fetched user ID. username: ${username} id: ${userId}`,
          );

          let xUserFollowingResponse;
          try {
            xUserFollowingResponse = await fetchAndDecodeJSON(
              XUserFollowingResponseSchema,
              `https://api.socialdata.tools/twitter/user/${userId}/following/${xBlocksenseAccountId}`,
              {
                headers: {
                  Authorization: `Bearer ${socialDataApiKey}`,
                },
              },
            );
          } catch (error) {
            if (error instanceof TooManyRequests) {
              console.warn(
                'Too many requests to X API, returning isFollowing as true',
              );
              return {
                isFollowing: true,
                userId: '',
              };
            } else {
              throw error;
            }
          }

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
          return await checkCodeRetweet(payload, tweetId, socialDataApiKey);
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
          let discordResponse;
          try {
            discordResponse = await fetchAndDecodeJSON(
              DiscordUserInfoResponseSchema,
              `https://discord.com/api/v10/guilds/${discordGuildId}/members/search?query=${username}`,
              {
                headers: {
                  Authorization: `Bot ${discordBotToken}`,
                },
              },
            );
          } catch (error) {
            if (error instanceof TooManyRequests) {
              console.warn(
                'Too many requests to Discord API, returning isMember as true',
              );
              return {
                isMember: true,
              };
            } else {
              throw error;
            }
          }

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
      const socialDataApiKey = env['SOCIAL_DATA_API_KEY'];
      const tweetId = env['X_BLOCKSENSE_TWEET_ID'];

      const { retweetCode, userId, discord, xHandle, accountAddress } = payload;

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
          // Check signature
          const message = `🏴‍☠️ Ahoy! ${discord}, known as @${xHandle}, is part of the Blocksense crew now — welcome aboard!`;
          const web3 = new Web3();
          const recoveredAddress = await web3.eth.accounts.recover(
            message,
            retweetCode,
          );
          const isSignatureCorrect =
            recoveredAddress.toLowerCase() === accountAddress.toLowerCase();

          if (!isSignatureCorrect) {
            console.error(
              `Retweet code signature does not match for users wallet ${accountAddress}`,
            );
            return {
              error: 'Retweet code signature does not match',
            };
          }

          // Check if user has retweeted the tweet with the correct code
          const retweetStatus = await checkCodeRetweet(
            { userId, retweetCode },
            tweetId,
            socialDataApiKey,
          );

          const { isRetweeted, isCodeCorrect } = retweetStatus;
          if (!isRetweeted) {
            return { error: 'You have not retweeted' };
          }
          if (!isCodeCorrect) {
            return {
              error: 'Your retweet does not contain the correct code',
            };
          }

          const client = createThirdwebClient({
            clientId: CLIENT_ID,
          });

          const contract = getContract({
            client,
            chain: arbitrum,
            address: CONTRACT_ADDRESS,
          });

          // Check if user already has an NFT
          const balance = await balanceOf({
            contract,
            owner: accountAddress,
          });

          if (balance > 0) {
            const error = `Account ${accountAddress} already has an NFT`;
            console.error(error);
            return { error };
          }

          const admin = privateKeyToAccount({
            client,
            privateKey: PRIVATE_KEY,
          });

          const { payload: generatedPayload, signature } =
            await generateMintSignature({
              account: admin,
              contract,
              mintRequest: {
                to: accountAddress,
                metadata,
              },
              contractType: 'TokenERC721',
            });

          console.log(
            `Successfully generated mint signature - ${signature} for account ${accountAddress}`,
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
            'INSERT INTO participants (x_handle, discord_username, wallet_address, minting_tx, is_verified) VALUES (?, ?, ?, ?, ?)';
          const insertResult = await db
            .prepare(insertQuery)
            .bind(
              payload.xHandle,
              payload.discordUsername,
              payload.walletAddress,
              payload.mintingTx,
              true,
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
