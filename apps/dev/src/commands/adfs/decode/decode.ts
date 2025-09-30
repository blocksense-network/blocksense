import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';

import { hexDataString } from '@blocksense/base-utils/buffer-and-hex';
import { txHash } from '@blocksense/base-utils/evm';
import { listEvmNetworks } from '@blocksense/config-types';
import {
  decodeADFSCalldata,
  type ParsedCalldataBase,
} from '@blocksense/contracts/calldata-decoder';
import { createViemClient } from '@blocksense/contracts/viem';

export const decode = Command.make(
  'decode',
  {
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()),
    ),
    txHash: Options.optional(
      Options.text('tx-hash').pipe(Options.withSchema(txHash)),
    ),
    calldata: Options.optional(
      Options.text('calldata').pipe(Options.withSchema(hexDataString)),
    ),
    hasStateHashAccumulator: Options.boolean('has-state-hash-accumulator'),
  },
  ({ calldata, hasStateHashAccumulator, network, txHash: tx }) =>
    Effect.gen(function* () {
      let rawCalldata: string;
      if (Option.isSome(calldata)) {
        rawCalldata = calldata.value;
      } else if (Option.isSome(network) && Option.isSome(tx)) {
        const client = createViemClient(network.value);
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

      let errors: Error[];
      let decoded: ParsedCalldataBase;

      if (!hasStateHashAccumulator) {
        const res = decodeADFSCalldata({
          calldata: rawCalldata,
          hasBlockNumber: true,
        });
        errors = res.errors;
        decoded = res.parsedCalldata;

        console.log(`\nblockNumber: ${res.parsedCalldata.blockNumber}`);
      } else {
        const res = decodeADFSCalldata({
          calldata: rawCalldata,
          hasBlockNumber: false,
        });
        errors = res.errors;
        decoded = res.parsedCalldata;

        console.log(
          `\nsourceAccumulator: ${res.parsedCalldata.sourceAccumulator}`,
        );
        console.log(
          `destinationAccumulator: ${
            res.parsedCalldata.destinationAccumulator
          }`,
        );
      }

      // Log errors if any
      if (errors.length > 0) {
        console.warn('Warnings/Errors during decoding:');
        for (const err of errors) {
          console.warn(`- ${err.message}`);
        }
      }

      console.log(`feedsLength: ${decoded.feeds.length}`);

      console.log('\nFeeds');
      console.table(decoded.feeds, [
        'index',
        'feedId',
        'feedIndex',
        'stride',
        'data',
      ]);

      console.log('\nRing Buffer Table');
      console.table(decoded.ringBufferTable, ['index', 'data']);
    }),
);
