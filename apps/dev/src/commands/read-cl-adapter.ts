import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';

import {
  getAddressExplorerUrl,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import { listEvmNetworks, readEvmDeployment } from '@blocksense/config-types';
import {
  CLAggregatorAdapterConsumer,
  type CLAggregatorAdapterData,
} from '@blocksense/contracts/viem';

const availableNetworks = await listEvmNetworks();

export const readClAdapter = Command.make(
  'read-cl-adapter',
  {
    network: Options.choice('network', availableNetworks),
    address: Options.optional(Options.text('address')),
    feedId: Options.optional(Options.integer('feed-id')),
    rpcUrl: Options.optional(Options.text('rpc-url')),
  },
  ({ address, feedId, network, rpcUrl }) =>
    Effect.gen(function* () {
      let resolvedAddress: string | undefined = Option.isSome(address)
        ? address.value
        : undefined;

      if (!resolvedAddress) {
        if (!Option.isSome(feedId)) {
          return yield* Effect.fail(
            new Error('Either --address or --feed-id is required'),
          );
        }
        const deploymentData = yield* Effect.tryPromise(() =>
          readEvmDeployment(network, true),
        );
        const entry =
          deploymentData.contracts?.CLAggregatorAdapter?.[`${feedId.value}`];
        if (!entry?.address) {
          return yield* Effect.fail(
            new Error(
              `CLAggregatorAdapter for feed-id ${feedId.value} not found on ${network}`,
            ),
          );
        }
        resolvedAddress = entry.address;
      }

      const consumer = Option.isSome(rpcUrl)
        ? CLAggregatorAdapterConsumer.createConsumerByRpcUrl(
            resolvedAddress as `0x${string}`,
            rpcUrl.value,
          )
        : CLAggregatorAdapterConsumer.createConsumerByNetworkName(
            resolvedAddress as `0x${string}`,
            network,
          );

      const data: CLAggregatorAdapterData | undefined =
        yield* Effect.tryPromise<CLAggregatorAdapterData>(() =>
          consumer.getCLAggregatorAdapterData(),
        ).pipe(
          Effect.catchAll(err => {
            const message = (err as Error)?.message ?? String(err);
            const cause = message.concat(` ${err.cause}`);
            if (cause.includes('multicall')) {
              return Effect.all(
                {
                  dataFeedStore: Effect.tryPromise(() =>
                    consumer.getDataFeedStore(),
                  ),
                  decimals: Effect.tryPromise(() => consumer.getDecimals()),
                  description: Effect.tryPromise(() =>
                    consumer.getDescription(),
                  ),
                  id: Effect.tryPromise(() => consumer.getId()),
                  latestAnswer: Effect.tryPromise(() =>
                    consumer.getLatestAnswer(),
                  ),
                  latestRound: Effect.tryPromise(() =>
                    consumer.getLatestRound(),
                  ),
                  latestRoundData: Effect.tryPromise(() =>
                    consumer.getLatestRoundData(),
                  ),
                },
                { concurrency: 'unbounded' },
              ).pipe(
                Effect.mapError(
                  e => new Error(String((e as any)?.message ?? e)),
                ),
                Effect.map(r =>
                  (r satisfies CLAggregatorAdapterData)
                    ? r
                    : (r as CLAggregatorAdapterData),
                ),
                Effect.catchAll(() => Effect.succeed(undefined)),
              );
            }
            throw new Error(
              `Error fetching data:\nMessage: ${message}\nCause: ${cause}`,
            );
          }),
        );

      if (!data)
        throw new Error('Failed to fetch data from CLAggregatorAdapter');

      const addrBranded = parseEthereumAddress(resolvedAddress);
      const rows: Array<[string, string]> = [
        ['Network', network],
        ['Address', resolvedAddress],
        ['Explorer', getAddressExplorerUrl(network, addrBranded)],
        ['Id', data.id.toString()],
        ['Description', data.description],
        ['Decimals', data.decimals.toString()],
        ['DataFeedStore', data.dataFeedStore],
        ['LatestAnswer', data.latestAnswer.toString()],
        ['LatestRound', data.latestRound.toString()],
        ['LatestRoundData.roundId', data.latestRoundData.roundId.toString()],
        ['LatestRoundData.answer', data.latestRoundData.answer.toString()],
        [
          'LatestRoundData.startedAt',
          data.latestRoundData.startedAt.toString(),
        ],
        [
          'LatestRoundData.updatedAt',
          data.latestRoundData.updatedAt.toString(),
        ],
        [
          'LatestRoundData.answeredInRound',
          data.latestRoundData.answeredInRound.toString(),
        ],
      ];

      renderTui(
        drawTable(
          rows.map(([k, v]) => [k, v]),
          {
            headers: ['Field', 'Value'],
          },
        ),
      );
    }),
);
