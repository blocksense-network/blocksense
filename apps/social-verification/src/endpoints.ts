import {
  Context,
  Effect as E,
  Effect,
  Layer,
  Redacted,
  Schema as S,
  Schedule,
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
  allowedOrigins: [
    'https://docs.blocksense.network',
    'https://blocksense.network',
  ],
  allowedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
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
  Layer.provide(
    HttpApiBuilder.group(verifyApi, 'newsletter', handlers =>
      handlers.handle('register', ({ payload }) => server.register(payload)),
    ),
  ),
  Layer.provide(
    HttpApiBuilder.group(verifyApi, 'letsTalk', handlers =>
      handlers.handle('sendEmail', ({ payload }) => server.sendEmail(payload)),
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
          const xUserInfoResponseTask = await Effect.async<
            boolean,
            Error | TooManyRequests
          >(resume => {
            fetchAndDecodeJSON(
              XUserInfoResponseSchema,
              `https://api.socialdata.tools/twitter/user/${username}`,
              {
                headers: {
                  Authorization: `Bearer ${socialDataApiKey}`,
                },
              },
            )
              .then(response => {
                console.log(
                  `Successfully fetched user info. username: ${username}`,
                );
                xUserInfoResponse = response;
                resume(Effect.succeed(true));
              })
              .catch(error => {
                if (error instanceof TooManyRequests) {
                  console.warn('Received TooManyRequests error, will retry...');
                  resume(Effect.fail(error));
                } else {
                  console.error(
                    `Error fetching user info for ${username}:`,
                    error,
                  );
                  resume(Effect.fail(error));
                }
              });
          });

          await Effect.runPromise(
            Effect.retry(xUserInfoResponseTask, {
              schedule: Schedule.exponential(1000),
              times: 3,
              until: err => !(err instanceof TooManyRequests),
            }),
          );

          const userId = xUserInfoResponse!.id_str;
          if (!userId) {
            console.error(`User ID not found in response for user ${username}`);
            throw new NotFound();
          }
          console.log(
            `Successfully fetched user ID. username: ${username} id: ${userId}`,
          );

          let xUserFollowingResponse;
          const xUserFollowingTask = await Effect.async<
            boolean,
            Error | TooManyRequests
          >(resume => {
            fetchAndDecodeJSON(
              XUserFollowingResponseSchema,
              `https://api.socialdata.tools/twitter/user/${userId}/following/${xBlocksenseAccountId}`,
              {
                headers: {
                  Authorization: `Bearer ${socialDataApiKey}`,
                },
              },
            )
              .then(response => {
                xUserFollowingResponse = response;
                console.log(
                  `Successfully fetched user following status. username: ${username} id: ${userId} isFollowing: ${xUserFollowingResponse.is_following}`,
                );
                resume(Effect.succeed(true));
              })
              .catch(error => {
                if (error instanceof TooManyRequests) {
                  console.warn('Received TooManyRequests error, will retry...');
                  resume(Effect.fail(error));
                } else {
                  console.error(
                    `Error fetching user following status for ${username}:`,
                    error,
                  );
                  resume(Effect.fail(error));
                }
              });
          });

          await Effect.runPromise(
            Effect.retry(xUserFollowingTask, {
              schedule: Schedule.exponential(1000),
              times: 3,
              until: err => !(err instanceof TooManyRequests),
            }),
          );

          return {
            isFollowing: xUserFollowingResponse!.is_following,
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

          const insertQuery = `
          INSERT INTO participants_unique
            (x_handle, discord_username, user_address, user_signature, minting_tx)
            VALUES (?, ?, ?, ?, ?)
          `;
          const insertResult = await db
            .prepare(insertQuery)
            .bind(
              payload.xHandle,
              payload.discordUsername,
              payload.walletAddress,
              payload.walletSignature,
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
          SELECT * FROM participants_unique
          WHERE x_handle = ?
            OR discord_username = ?
            OR user_address = ?
            OR user_signature = ?
          `;
          const selectResult = await db
            .prepare(selectQuery)
            .bind(
              payload.xHandle,
              payload.discordUsername,
              payload.walletAddress,
              payload.walletSignature,
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

  register: payload =>
    Effect.contextWithEffect(context =>
      Effect.tryPromise({
        try: async () => {
          const db = getEnv(context).newsletterDB;
          console.log(
            `Inserting newsletter subscriber data.\n` + JSON.stringify(payload),
          );

          const insertResult = await db
            .prepare(
              'INSERT INTO newsletter_subscribers (email, interests) VALUES (?, ?) ON CONFLICT(email) DO NOTHING',
            )
            .bind(payload.email, payload.interests.join(', '))
            .all();

          console.log(
            `Successfully inserted newsletter subscriber data: `,
            insertResult,
          );
        },
        catch: error => {
          console.error(error);
          throw new Error('Failed to register email');
        },
      }),
    ),

  sendEmail: payload => {
    return Effect.contextWithEffect(context => {
      const SENDGRID_API_KEY = getEnv(context).SENDGRID_API_KEY;

      return Effect.tryPromise({
        try: async () => {
          await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: { email: 'hi@blocksense.network' },
              personalizations: [
                {
                  to: [{ email: payload.email }],
                  subject: 'Welcome aboard the Blocksense ship ⚓',
                },
              ],
              content: [
                {
                  type: 'text/html',
                  value: `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;width:100%;">
                      <tr>
                        <td>

                          <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:16px;padding:24px;color:#171717;">
                            <h1 style="margin:0 0 12px 0;font-size:24px;">
                              Welcome aboard the Blocksense ship 🏴‍☠️
                            </h1>

                            <p style="margin:0 0 12px 0;font-size:16px;">
                              Hi ${payload.name},
                            </p>

                            <p style="margin:0 0 12px 0;font-size:16px;">
                              Thanks for contacting us through our
                              <a href="https://blocksense.network/lets-talk" target="_blank" rel="noopener noreferrer" style="color:#1A57FF;text-decoration:underline;">let's talk form</a>.
                              We'll be in touch soon to learn more about your use case and how Blocksense can help.
                            </p>

                            <p style="margin:0 0 12px 0;font-size:16px;">
                              In the meantime, the best way to stay in the loop is to join the crew:
                            </p>

                            <ul style="margin:0;padding:0 0 20px 20px;list-style:disc;list-style-position:outside;">
                              <li style="margin:0 0 8px 0;">
                                <a href="https://docs.blocksense.network" target="_blank" rel="noopener noreferrer" style="color:#1A57FF;text-decoration:underline;">Explore the Docs</a>
                              </li>
                              <li style="margin:0 0 8px 0;">
                                <a href="https://blocksense.network/resources/litepaper" target="_blank" rel="noopener noreferrer" style="color:#1A57FF;text-decoration:underline;">Read the Litepaper</a>
                              </li>
                              <li style="margin:0 0 8px 0;">
                                <a href="https://github.com/blocksense-network/BlocksenseOS" target="_blank" rel="noopener noreferrer" style="color:#1A57FF;text-decoration:underline;">Learn about BlocksenseOS</a>
                              </li>
                            </ul>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td align="left" valign="top" width="50%" style="padding:0 8px 0 0;">
                                  <a href="https://x.com/blocksense_" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:block;">
                                    <div style="background-color:#2c2c2c;border-radius:16px;padding:12px;color:#ffffff">
                                      <h2 style="margin:0;font-size:16px;color:#ffffff;">70K+</h2>
                                      <p style="margin:0;font-size:12px;color:#F4F3F3;">FOLLOWERS ON X</p>
                                      <p style="margin:6px 0 0 0;font-size:10px;color:#D2D2D2;">Follow us on X</p>
                                    </div>
                                  </a>
                                </td>
                                <td align="left" valign="top" width="50%" style="padding:0 0 0 8px;">
                                  <a href="https://discord.com/invite/blocksense" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:block;">
                                    <div style="background-color:#2c2c2c;border-radius:16px;padding:12px;color:#ffffff">
                                      <h2 style="margin:0;font-size:16px;color:#ffffff;">80K+</h2>
                                      <p style="margin:0;font-size:12px;color:#F4F3F3;">COMMUNITY MEMBERS</p>
                                      <p style="margin:6px 0 0 0;font-size:10px;color:#D2D2D2;">Become a member</p>
                                    </div>
                                  </a>
                                </td>
                              </tr>
                            </table>

                            <p style="margin:16px 0 0 0;font-size:16px;">
                              See you on board.
                            </p>
                            <p style="margin:2px 0 0 0;font-size:12px;color:#3A3A3A;">
                              - The Blocksense Team
                            </p>
                          </div>

                        </td>
                      </tr>
                    </table>
                  `,
                },
              ],
            }),
          });
        },
        catch: error => {
          console.error('Error sending email:', error);
          throw new Error('Failed to send email');
        },
      });
    });
  },
};
