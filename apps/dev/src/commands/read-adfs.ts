import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';

import {
  getAddressExplorerUrl,
  parseEthereumAddress,
  type EthereumAddress,
} from '@blocksense/base-utils/evm';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import { listEvmNetworks, readEvmDeployment } from '@blocksense/config-types';
import { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';

const availableNetworks = await listEvmNetworks();

export const readAdfs = Command.make(
  'read-adfs',
  {
    network: Options.choice('network', availableNetworks),
    address: Options.optional(Options.text('address')),
    rpcUrl: Options.optional(Options.text('rpc-url')),
    feedId: Options.integer('feed-id'),
    index: Options.optional(Options.integer('index')),
    startSlot: Options.optional(Options.integer('start-slot')),
    slots: Options.optional(Options.integer('slots')),
    multi: Options.boolean('multi').pipe(Options.withDefault(false)),
  },
  ({ address, feedId, index, multi, network, rpcUrl, slots, startSlot }) =>
    Effect.gen(function* () {
      let resolvedAddress: EthereumAddress;
      if (Option.isSome(address)) {
        resolvedAddress = yield* Effect.try({
          try: () => parseEthereumAddress(address.value),
          catch: e =>
            new Error(
              `Invalid Ethereum address ${address.value}: ${(e as Error)?.message}`,
            ),
        });
      } else {
        const deployment = yield* Effect.tryPromise(() =>
          readEvmDeployment(network, true),
        );
        const addr = deployment.contracts?.coreContracts?.UpgradeableProxyADFS
          ?.address as string | undefined;
        if (!addr)
          return yield* Effect.fail(
            new Error(
              `UpgradeableProxyADFS address not found in deployment for network ${network}`,
            ),
          );
        resolvedAddress = yield* Effect.try({
          try: () => parseEthereumAddress(addr),
          catch: e =>
            new Error(
              `Invalid Ethereum address from deployment ${addr}: ${(e as Error)?.message}`,
            ),
        });
      }

      const consumer = Option.isSome(rpcUrl)
        ? AggregatedDataFeedStoreConsumer.createConsumerByRpcUrl(
            resolvedAddress,
            rpcUrl.value,
          )
        : AggregatedDataFeedStoreConsumer.createConsumerByNetworkName(
            resolvedAddress,
            network,
          );

      const feed = BigInt(feedId);

      const hasSlice = Option.isSome(startSlot) || Option.isSome(slots);
      const start = Option.isSome(startSlot) ? startSlot.value : 0;
      const len = Option.isSome(slots) ? slots.value : 0;

      type DataRow = Array<[string, string]>;
      const rows: DataRow = [];

      if (Option.isSome(index)) {
        rows.push(['Mode', 'Index']);
        rows.push(['Feed Id', feed.toString()]);
        rows.push(['Index', index.value.toString()]);

        if (hasSlice) {
          const data = yield* Effect.tryPromise(() =>
            consumer.getDataSliceAtIndex(feed, index.value, start, len),
          );
          data.forEach((word, i) => rows.push([`Data[${i}]`, word]));
        } else if (multi) {
          const data = yield* Effect.tryPromise(() =>
            consumer.getDataAtIndex(feed, index.value),
          );
          data.forEach((word, i) => rows.push([`Data[${i}]`, word]));
        } else {
          const data = yield* Effect.tryPromise(() =>
            consumer.getSingleDataAtIndex(feed, index.value),
          );
          rows.push(['Data', data]);
        }
      } else {
        rows.push(['Mode', 'Latest']);
        rows.push(['Feed Id', feed.toString()]);

        if (hasSlice) {
          const { data, index } = yield* Effect.tryPromise(() =>
            consumer.getLatestDataSliceAndIndex(feed, start, len),
          );
          rows.push(['Index', index.toString()]);
          (data as Array<string>).forEach((word, i) =>
            rows.push([`Data[${i}]`, word]),
          );
        } else if (multi) {
          const { data, index } = yield* Effect.tryPromise(() =>
            consumer.getLatestDataAndIndex(feed),
          );
          rows.push(['Index', index.toString()]);
          (data as Array<string>).forEach((word, i) =>
            rows.push([`Data[${i}]`, word]),
          );
        } else {
          const { data, index } = yield* Effect.tryPromise(() =>
            consumer.getLatestSingleDataAndIndex(feed),
          );
          rows.push(['Index', index.toString()]);
          rows.push(['Data', data as string]);
        }
      }

      rows.unshift([
        'Explorer',
        getAddressExplorerUrl(network, resolvedAddress),
      ]);
      rows.unshift(['Address', resolvedAddress]);
      rows.unshift(['Network', network]);

      renderTui(
        drawTable(rows, {
          headers: ['Field', 'Value'],
        }),
      );
    }),
);
