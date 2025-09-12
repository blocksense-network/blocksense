import { Command, Options } from '@effect/cli';
import { Data, Effect, Option } from 'effect';

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
    round: Options.optional(Options.integer('round')),
    rpcUrl: Options.optional(Options.text('rpc-url')),
  },
  ({ address, feedId, network, round, rpcUrl }) =>
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

      const contractAddress = yield* Effect.try({
        try: () => parseEthereumAddress(resolvedAddress!),
        catch: e =>
          new Error(
            `Invalid Ethereum address ${resolvedAddress}: ${(e as Error)?.message}`,
          ),
      });

      const consumer = Option.isSome(rpcUrl)
        ? CLAggregatorAdapterConsumer.createConsumerByRpcUrl(
            contractAddress,
            rpcUrl.value,
          )
        : CLAggregatorAdapterConsumer.createConsumerByNetworkName(
            contractAddress,
            network,
          );

      if (Option.isSome(round)) {
        const requestedRound = BigInt(round.value);

        const { id, roundData } = yield* Effect.all(
          {
            id: Effect.tryPromise(() => consumer.getId()),
            roundData: Effect.tryPromise(() =>
              consumer.getRoundData(requestedRound),
            ),
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.mapError(
            e =>
              new FetchError({
                message: `Failed to fetch data for round ${round.value}: ${String((e as any)?.message ?? e)}`,
              }),
          ),
        );

        const rows: Array<[string, string]> = [
          ['Network', network],
          ['Address', contractAddress],
          ['Explorer', getAddressExplorerUrl(network, contractAddress)],
          ['Id', id.toString()],
          ['Round', requestedRound.toString()],
          ['Answer', roundData.answer.toString()],
        ];

        renderTui(
          drawTable(
            rows.map(([k, v]) => [k, v]),
            {
              headers: ['Field', 'Value'],
            },
          ),
        );

        return;
      }

      const data: CLAggregatorAdapterData = yield* Effect.tryPromise(() =>
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
                description: Effect.tryPromise(() => consumer.getDescription()),
                id: Effect.tryPromise(() => consumer.getId()),
                latestAnswer: Effect.tryPromise(() =>
                  consumer.getLatestAnswer(),
                ),
                latestRound: Effect.tryPromise(() => consumer.getLatestRound()),
                latestRoundData: Effect.tryPromise(() =>
                  consumer.getLatestRoundData(),
                ),
              },
              { concurrency: 'unbounded' },
            ).pipe(
              Effect.mapError(
                e =>
                  new FetchError({
                    message: String(e),
                  }),
              ),
            );
          }
          return Effect.fail(
            new FetchError({
              message: `Error fetching data:\nMessage: ${message}\nCause: ${cause}`,
            }),
          );
        }),
      );

      const rows: Array<[string, string]> = [
        ['Network', network],
        ['Address', contractAddress],
        ['Explorer', getAddressExplorerUrl(network, contractAddress)],
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

export class FetchError extends Data.TaggedError('@dev/FetchError')<{
  readonly message: string;
}> {}
