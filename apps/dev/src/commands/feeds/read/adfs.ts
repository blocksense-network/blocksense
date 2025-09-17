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
import { skip0x } from '@blocksense/base-utils';

const availableNetworks = await listEvmNetworks();

// Helper: parse single ADFS data word into value + timestamp parts
function formatNumericalValue(hexData: `0x${string}`) {
  const cleanHex = skip0x(hexData);
  const valueHex = '0x' + cleanHex.slice(0, 48);
  const value = BigInt(valueHex);
  let timestamp: bigint | null = null;
  let timestampHex: string | null = null;
  if (cleanHex.length >= 64) {
    timestampHex = '0x' + cleanHex.slice(48, 64); // next 8 bytes (16 hex chars)
    try {
      timestamp = BigInt(timestampHex);
    } catch {
      timestamp = null;
    }
  }
  // Produce formatted timestamp (try to detect ms vs s)
  let formattedTimestamp: string | null = null;
  if (timestamp !== null) {
    const tNum = Number(timestamp);
    if (Number.isFinite(tNum)) {
      const isMs = tNum >= 1_000_000_000_000; // heuristic
      const date = new Date(isMs ? tNum : tNum * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      formattedTimestamp = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} (${timestamp.toString()}${isMs ? ' ms' : ' s'})`;
    }
  }
  return {
    rawHex: hexData,
    value: value.toString(),
    valueHex,
    timestamp: timestamp ? timestamp.toString() : null,
    timestampHex,
    formattedTimestamp,
  } as const;
}

export const adfs = Command.make(
  'adfs',
  {
    network: Options.choice('network', availableNetworks),
    address: Options.optional(Options.text('address')),
    rpcUrl: Options.optional(Options.text('rpc-url')),
    feedId: Options.integer('feed-id'),
    index: Options.optional(Options.integer('index')),
    startSlot: Options.optional(Options.integer('start-slot')),
    slots: Options.optional(Options.integer('slots')),
    multi: Options.boolean('multi').pipe(Options.withDefault(false)),
    humanReadable: Options.boolean('human-readable').pipe(
      Options.withDefault(false),
    ),
  },
  ({
    address,
    feedId,
    humanReadable,
    index,
    multi,
    network,
    rpcUrl,
    slots,
    startSlot,
  }) =>
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
      const isHumanReadable = humanReadable; // already boolean due to withDefault

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
          const single = yield* Effect.tryPromise(() =>
            consumer.getSingleDataAtIndex(feed, index.value),
          );
          if (isHumanReadable && !hasSlice && !multi) {
            const parsed = formatNumericalValue(single);
            rows.push(['Data (Raw)', parsed.rawHex]);
            rows.push(['Value', parsed.value]);
            if (parsed.timestamp) {
              rows.push(['Timestamp', parsed.timestamp]);
              rows.push(['Timestamp (Hex)', parsed.timestampHex ?? '']);
              if (parsed.formattedTimestamp)
                rows.push(['Timestamp (Formatted)', parsed.formattedTimestamp]);
            }
          } else {
            rows.push(['Data', single]);
          }
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
          if (isHumanReadable && !hasSlice && !multi) {
            const parsed = formatNumericalValue(data as `0x${string}`);
            rows.push(['Data (Raw)', parsed.rawHex]);
            rows.push(['Value', parsed.value]);
            if (parsed.timestamp) {
              rows.push(['Timestamp', parsed.timestamp]);
              rows.push(['Timestamp (Hex)', parsed.timestampHex ?? '']);
              if (parsed.formattedTimestamp)
                rows.push(['Timestamp (Formatted)', parsed.formattedTimestamp]);
            }
          } else {
            rows.push(['Data', data as string]);
          }
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
