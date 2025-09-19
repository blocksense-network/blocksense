import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { createPublicClient, http } from 'viem';

import { decodeADFSCalldata } from '@blocksense/contracts/calldata-decoder';
import { listEvmNetworks } from '@blocksense/config-types';
import { getViemChain } from '@blocksense/contracts/viem';
import type { NetworkName } from '@blocksense/base-utils/evm';
import { getRpcUrl, txHash } from '@blocksense/base-utils/evm';
import { hexDataString } from '@blocksense/base-utils/buffer-and-hex';

function getPublicClient(networkName: NetworkName) {
  const chain = getViemChain(networkName);

  return createPublicClient({
    chain,
    transport: chain
      ? http(chain.rpcUrls.default.http[0])
      : http(getRpcUrl(networkName)),
  });
}

export const decode = Command.make(
  'decode',
  {
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()),
    ),
    tx: Options.optional(Options.text('tx').pipe(Options.withSchema(txHash))),
    calldata: Options.optional(
      Options.text('calldata').pipe(Options.withSchema(hexDataString)),
    ),
    hasBlockNumber: Options.choice('has-block-number', ['true', 'false']).pipe(
      Options.withDefault('true'),
    ),
  },
  ({ calldata, hasBlockNumber, network, tx }) =>
    Effect.gen(function* () {
      let rawCalldata: string;
      if (Option.isSome(calldata)) {
        rawCalldata = calldata.value;
      } else if (Option.isSome(network) && Option.isSome(tx)) {
        const client = getPublicClient(network.value);
        const txData = yield* Effect.tryPromise(() =>
          client.getTransaction({ hash: tx.value }),
        );
        if (!txData || typeof txData !== 'object' || !('input' in txData))
          return yield* Effect.fail(
            new Error('Transaction calldata not found'),
          );
        rawCalldata = (txData as { input: string }).input;
      } else {
        return yield* Effect.fail(
          new Error('Provide either --calldata or both --network and --tx'),
        );
      }
      const decoded = decodeADFSCalldata(
        rawCalldata,
        hasBlockNumber === 'true',
      );

      const feeds = (decoded as any).feeds ?? [];
      const ringBufferTable = (decoded as any).ringBufferTable ?? [];
      const blockNumber = (decoded as any).blockNumber;

      const blockNumberStr =
        typeof blockNumber === 'bigint'
          ? blockNumber.toString()
          : (blockNumber ?? '(unknown)');
      const feedsLength = Array.isArray(feeds) ? feeds.length : 0;
      console.log(`\nblockNumber: ${blockNumberStr}`);
      console.log(`feedsLength: ${feedsLength}`);

      if (Array.isArray(feeds) && feeds.length > 0) {
        const rows = feeds.map((f: any) => ({
          index: typeof f.index === 'bigint' ? f.index.toString() : f.index,
          feedId: typeof f.feedId === 'bigint' ? f.feedId.toString() : f.feedId,
          feedIndex:
            typeof f.feedIndex === 'bigint'
              ? f.feedIndex.toString()
              : f.feedIndex,
          stride: typeof f.stride === 'bigint' ? f.stride.toString() : f.stride,
          data: f.data,
        }));
        console.log('\nFeeds');
        console.table(rows, ['index', 'feedId', 'feedIndex', 'stride', 'data']);
      } else {
        console.log('\nFeeds: (none)');
      }

      if (Array.isArray(ringBufferTable) && ringBufferTable.length > 0) {
        const rows = ringBufferTable.map((r: any) => ({
          index: typeof r.index === 'bigint' ? r.index.toString() : r.index,
          data: r.data,
        }));
        console.log('\nRing Buffer Table');
        console.table(rows, ['index', 'data']);
      } else {
        console.log('\nRing Buffer Table: (none)');
      }
    }),
);
