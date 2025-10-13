import { Data, Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';

import {
  getAddressExplorerUrl,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { drawTable, renderTui } from '@blocksense/base-utils/tty';
import { listEvmNetworks, readEvmDeployment } from '@blocksense/config-types';
import {
  CLAggregatorAdapterConsumer,
  type CLAggregatorAdapterData,
} from '@blocksense/contracts/viem';

import { formatTimestamp } from '../../utils';

export const clAdapter = Command.make(
  'cl-adapter',
  {
    network: Options.choice('network', await listEvmNetworks()),
    address: Options.optional(Options.text('address')),
    feedId: Options.optional(Options.integer('feed-id')),
    round: Options.optional(Options.integer('round')),
    rpcUrl: Options.optional(
      Options.text('rpc-url').pipe(Options.withSchema(S.URL)),
    ),
    humanReadable: Options.optional(
      Options.boolean('human-readable').pipe(Options.withAlias('h')),
    ),
  },
  ({ address, feedId, humanReadable, network, round, rpcUrl }) =>
    Effect.gen(function* () {
      const isHumanReadable =
        Option.isSome(humanReadable) && humanReadable.value;
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

      const consumer = CLAggregatorAdapterConsumer.create(
        contractAddress,
        Option.isSome(rpcUrl) ? rpcUrl.value : network,
      );

      if (Option.isSome(round)) {
        const requestedRound = BigInt(round.value);

        const { decimals, id, roundData } = yield* Effect.all(
          {
            id: Effect.tryPromise(() => consumer.getId()),
            roundData: Effect.tryPromise(() =>
              consumer.getRoundData(requestedRound),
            ),
            decimals: Effect.tryPromise(() => consumer.getDecimals()),
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
          [
            'Answer',
            formatNumericalValue(roundData.answer, decimals, isHumanReadable),
          ],
          ['Decimals', decimals.toString()],
          ['LatestRoundData.startedAt', formatTimestamp(roundData.startedAt)],
          ['LatestRoundData.updatedAt', formatTimestamp(roundData.updatedAt)],
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
        [
          'LatestAnswer',
          formatNumericalValue(
            data.latestAnswer,
            data.decimals,
            isHumanReadable,
          ),
        ],
        ['LatestRound', data.latestRound.toString()],
        ['LatestRoundData.roundId', data.latestRoundData.roundId.toString()],
        [
          'LatestRoundData.answer',
          formatNumericalValue(
            data.latestRoundData.answer,
            data.decimals,
            isHumanReadable,
          ),
        ],
        [
          'LatestRoundData.startedAt',
          formatTimestamp(data.latestRoundData.startedAt),
        ],
        [
          'LatestRoundData.updatedAt',
          formatTimestamp(data.latestRoundData.updatedAt),
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

function formatNumericalValue(
  value: bigint,
  decimals: number,
  humanReadable: boolean,
): string {
  if (!humanReadable) return value.toString();
  const decimalsBig = BigInt(decimals);
  if (decimalsBig === 0n) return value.toString();
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** decimalsBig;
  const whole = abs / base;
  const fraction = abs % base;
  let fractionStr = fraction.toString().padStart(Number(decimalsBig), '0');
  fractionStr = fractionStr.replace(/0+$/u, '');
  const formatted =
    fractionStr.length > 0
      ? `${whole.toString()}.${fractionStr}`
      : whole.toString();
  return negative ? `-${formatted}` : formatted;
}

class FetchError extends Data.TaggedError('@dev/FetchError')<{
  readonly message: string;
}> {}
